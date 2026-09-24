import type { Actor } from '../../shared/auth.js';
import { withTransaction, type Db } from '../../shared/db.js';
import { DomainErrors, fail } from '../domain/errors.js';
import { checkTransition, type OrderStatus } from '../domain/order.js';
import { verifyDoctorLicense } from '../domain/prescription.js';
import { appendEvents, type DomainEvent } from '../events.js';
import { isUuid, requirePatient, requireStaff, type CommandContext, type HandlerOutput } from '../types.js';

type PrescriptionState = 'PENDING_REVIEW' | 'AUTO_VERIFIED' | 'APPROVED' | 'REJECTED';

export interface OrderTransition {
  orderId: string;
  status: OrderStatus;
  aggregateVersion: number;
}

interface LockedOrder {
  id: string;
  patient_id: string;
  status: OrderStatus;
  version: number;
  prescription_status: PrescriptionState | null;
  controlled_ids: number[];
}

/** Carga el agregado Order con bloqueo de fila (serializa comandos concurrentes sobre el mismo pedido). */
async function lockOrder(db: Db, orderId: string): Promise<LockedOrder> {
  if (!isUuid(orderId)) fail(DomainErrors.notFound('Pedido', orderId));
  const [order] = await db.query<LockedOrder>(
    `SELECT o.id, o.patient_id, o.status, o.version, p.status AS prescription_status,
            ARRAY(SELECT oi.medication_id FROM order_items oi
                   WHERE oi.order_id = o.id AND oi.requires_prescription
                   ORDER BY oi.medication_id) AS controlled_ids
       FROM orders o LEFT JOIN prescriptions p ON p.order_id = o.id
      WHERE o.id = $1
      FOR UPDATE OF o`,
    [orderId],
  );
  return order ?? fail(DomainErrors.notFound('Pedido', orderId));
}

async function transition(db: Db, order: LockedOrder, to: OrderStatus, reason: string | null): Promise<number> {
  const error = checkTransition(order.status, to);
  if (error) fail(error);
  const [row] = await db.query<{ version: number }>(
    `UPDATE orders SET status = $2, status_reason = $3, version = version + 1, updated_at = now()
      WHERE id = $1 RETURNING version`,
    [order.id, to, reason],
  );
  return row.version;
}

async function setPrescriptionStatus(db: Db, orderId: string, status: PrescriptionState, notes: string | null) {
  await db.query(
    `UPDATE prescriptions SET status = $2, review_notes = COALESCE($3, review_notes), reviewed_at = now() WHERE order_id = $1`,
    [orderId, status, notes],
  );
}

/** Devuelve al inventario las unidades reservadas por el pedido (cancelación / rechazo). */
async function releaseStock(db: Db, orderId: string) {
  await db.query(
    `SELECT i.medication_id FROM inventory i
       JOIN order_items oi ON oi.medication_id = i.medication_id AND oi.order_id = $1
      ORDER BY i.medication_id FOR UPDATE OF i`,
    [orderId],
    'lock inventario',
  );
  return db.query<{ medication_id: number; available: number; quantity: number }>(
    `UPDATE inventory i
        SET available = i.available + oi.quantity,
            reserved  = i.reserved - oi.quantity,
            version   = i.version + 1,
            updated_at = now()
       FROM order_items oi
      WHERE oi.order_id = $1 AND i.medication_id = oi.medication_id
    RETURNING i.medication_id, i.available, oi.quantity`,
    [orderId],
    'libera stock',
  );
}

/** Cancelación compartida por cancelOrder, rejectOrder y el verificador de fórmulas. */
async function cancel(db: Db, order: LockedOrder, actor: Actor, reason: string) {
  const version = await transition(db, order, 'CANCELLED', reason);
  const prescriptionStatus = order.prescription_status ? 'REJECTED' : null;
  if (prescriptionStatus) await setPrescriptionStatus(db, order.id, prescriptionStatus, reason);
  const released = await releaseStock(db, order.id);
  const events: DomainEvent[] = [
    { type: 'OrderCancelled', orderId: order.id, version, from: order.status, cancelledBy: actor.fullName, reason, prescriptionStatus },
    {
      type: 'InventoryReleased',
      orderId: order.id,
      items: released.map((row) => ({ medicationId: row.medication_id, quantity: row.quantity, available: row.available })),
    },
  ];
  return { version, events: await appendEvents(db, events) };
}

// ─────────────────────────────────────────────────────────────────────

export async function approveOrder(
  input: { orderId: string; notes?: string | null },
  ctx: CommandContext,
): Promise<HandlerOutput<OrderTransition>> {
  const actor = requireStaff(ctx.actor);
  return withTransaction(ctx.stats, async (db) => {
    const order = await lockOrder(db, input.orderId);
    const transitionError = checkTransition(order.status, 'APPROVED');
    if (transitionError) fail(transitionError);

    // Invariante: sin fórmula válida no se aprueba un pedido con medicamentos controlados.
    let prescriptionStatus: PrescriptionState | null = null;
    if (order.controlled_ids.length > 0) {
      if (!order.prescription_status) {
        const names = await db.query<{ commercial_name: string }>(
          `SELECT commercial_name FROM medications WHERE id = ANY($1::int[]) ORDER BY id`,
          [order.controlled_ids],
        );
        fail(DomainErrors.prescriptionRequired(order.controlled_ids, names.map((row) => row.commercial_name)));
      }
      if (order.prescription_status === 'REJECTED') {
        fail(DomainErrors.validation('prescription', 'La fórmula médica de este pedido fue rechazada.'));
      }
      if (actor.role === 'SYSTEM') {
        fail(DomainErrors.unauthorized('Un pedido con fórmula médica requiere aprobación humana.'));
      }
      prescriptionStatus = 'APPROVED';
      await setPrescriptionStatus(db, order.id, prescriptionStatus, input.notes ?? null);
    }

    const notes = input.notes?.trim() || null;
    const version = await transition(db, order, 'APPROVED', notes);
    const events = await appendEvents(db, [
      { type: 'OrderApproved', orderId: order.id, version, approvedBy: actor.fullName, notes, prescriptionStatus },
    ]);
    return { value: { orderId: order.id, status: 'APPROVED', aggregateVersion: version }, events };
  });
}

export async function rejectOrder(
  input: { orderId: string; reason: string },
  ctx: CommandContext,
): Promise<HandlerOutput<OrderTransition>> {
  const actor = requireStaff(ctx.actor);
  const reason = input.reason.trim();
  if (reason.length < 5) fail(DomainErrors.validation('reason', 'Explica el motivo del rechazo (mínimo 5 caracteres).'));
  return withTransaction(ctx.stats, async (db) => {
    const order = await lockOrder(db, input.orderId);
    const { version, events } = await cancel(db, order, actor, reason);
    return { value: { orderId: order.id, status: 'CANCELLED', aggregateVersion: version }, events };
  });
}

export async function dispatchOrder(
  input: { orderId: string },
  ctx: CommandContext,
): Promise<HandlerOutput<OrderTransition>> {
  const actor = requireStaff(ctx.actor);
  return withTransaction(ctx.stats, async (db) => {
    const order = await lockOrder(db, input.orderId);
    const version = await transition(db, order, 'DISPATCHED', null);
    // Las unidades salen de bodega: dejan de estar "reservadas". `available` no cambia.
    await db.query(
      `UPDATE inventory i SET reserved = i.reserved - oi.quantity, version = i.version + 1, updated_at = now()
         FROM order_items oi
        WHERE oi.order_id = $1 AND i.medication_id = oi.medication_id`,
      [order.id],
    );
    const events = await appendEvents(db, [{ type: 'OrderDispatched', orderId: order.id, version, dispatchedBy: actor.fullName }]);
    return { value: { orderId: order.id, status: 'DISPATCHED', aggregateVersion: version }, events };
  });
}

export async function cancelOrder(
  input: { orderId: string; reason?: string | null },
  ctx: CommandContext,
): Promise<HandlerOutput<OrderTransition>> {
  const patient = requirePatient(ctx.actor);
  return withTransaction(ctx.stats, async (db) => {
    const order = await lockOrder(db, input.orderId);
    if (order.patient_id !== patient.id) fail(DomainErrors.notFound('Pedido', input.orderId));
    const reason = input.reason?.trim() || 'Cancelado por el paciente.';
    const { version, events } = await cancel(db, order, patient, reason);
    return { value: { orderId: order.id, status: 'CANCELLED', aggregateVersion: version }, events };
  });
}

/**
 * Comando interno (no expuesto en GraphQL): lo dispara el process manager
 * unos segundos después de OrderPlaced para simular la verificación
 * asíncrona del prescriptor contra el registro oficial.
 */
export async function verifyPrescription(
  input: { orderId: string },
  ctx: CommandContext,
): Promise<HandlerOutput<{ outcome: 'VERIFIED' | 'REJECTED' | 'SKIPPED' }>> {
  const actor = requireStaff(ctx.actor);
  return withTransaction(ctx.stats, async (db) => {
    const order = await lockOrder(db, input.orderId);
    if (order.status !== 'PENDING_APPROVAL' || order.prescription_status !== 'PENDING_REVIEW') {
      return { value: { outcome: 'SKIPPED' }, events: [] };
    }
    const [prescription] = await db.query<{ doctor_license: string }>(
      `SELECT doctor_license FROM prescriptions WHERE order_id = $1`,
      [order.id],
    );
    const check = verifyDoctorLicense(prescription.doctor_license);
    if (!check.valid) {
      const { events } = await cancel(db, order, actor, check.reason);
      return { value: { outcome: 'REJECTED' }, events };
    }
    const notes = `Registro médico ${prescription.doctor_license} verificado automáticamente.`;
    await setPrescriptionStatus(db, order.id, 'AUTO_VERIFIED', notes);
    const [row] = await db.query<{ version: number }>(
      `UPDATE orders SET version = version + 1, updated_at = now() WHERE id = $1 RETURNING version`,
      [order.id],
    );
    const events = await appendEvents(db, [{ type: 'PrescriptionVerified', orderId: order.id, version: row.version, notes }]);
    return { value: { outcome: 'VERIFIED' }, events };
  });
}
