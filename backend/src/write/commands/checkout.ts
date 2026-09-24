import { withTransaction } from '../../shared/db.js';
import { DomainErrors, fail } from '../domain/errors.js';
import { findStockShortages, linesRequiringPrescription, orderTotal, type OrderLineDraft } from '../domain/order.js';
import { validatePrescription, type PrescriptionInput } from '../domain/prescription.js';
import { appendEvents } from '../events.js';
import { requirePatient, type CommandContext, type HandlerOutput } from '../types.js';

export interface OrderReceipt {
  orderId: string;
  status: 'PENDING_APPROVAL';
  total: string;
  itemCount: number;
  requiresPrescription: boolean;
  acceptedAt: Date;
}

/**
 * Comando CheckoutCart — "quiero comprar lo que tengo en el carrito".
 *
 * Todo ocurre en UNA transacción:
 *   1. Bloquea el carrito abierto y lee sus ítems con precio y bandera de fórmula.
 *   2. Invariante de fórmula: si algún ítem la exige, PrescriptionInput es obligatorio y válido.
 *   3. Bloquea las filas de inventario (FOR UPDATE, orden por id → sin deadlocks).
 *   4. Invariante de stock: ninguna cantidad supera lo disponible.
 *   5. Reserva el stock, crea orden + ítems + fórmula, cierra el carrito.
 *   6. Registra los eventos OrderPlaced e InventoryReserved en el outbox.
 * Cualquier violación lanza DomainFailure → ROLLBACK → nada queda a medias.
 */
export async function checkoutCart(
  input: { prescription?: PrescriptionInput | null },
  ctx: CommandContext,
): Promise<HandlerOutput<OrderReceipt>> {
  const patient = requirePatient(ctx.actor);

  return withTransaction(ctx.stats, async (db) => {
    // 1 ─ carrito
    const [cart] = await db.query<{ id: string }>(
      `SELECT id FROM carts WHERE patient_id = $1 AND status = 'OPEN' FOR UPDATE`,
      [patient.id],
    );
    if (!cart) fail(DomainErrors.emptyCart());

    const rows = await db.query<{
      medication_id: number;
      quantity: number;
      commercial_name: string;
      presentation: string;
      price: string;
      requires_prescription: boolean;
    }>(
      `SELECT ci.medication_id, ci.quantity, m.commercial_name, m.presentation, m.price, m.requires_prescription
         FROM cart_items ci JOIN medications m ON m.id = ci.medication_id
        WHERE ci.cart_id = $1
        ORDER BY ci.medication_id`,
      [cart.id],
    );
    if (rows.length === 0) fail(DomainErrors.emptyCart());

    const lines: OrderLineDraft[] = rows.map((row) => ({
      medicationId: row.medication_id,
      name: row.commercial_name,
      presentation: row.presentation,
      quantity: row.quantity,
      unitPrice: row.price,
      requiresPrescription: row.requires_prescription,
    }));

    // 2 ─ invariante: fórmula médica
    const controlled = linesRequiringPrescription(lines);
    const needsPrescription = controlled.length > 0;
    if (needsPrescription) {
      if (!input.prescription) {
        fail(DomainErrors.prescriptionRequired(controlled.map((l) => l.medicationId), controlled.map((l) => l.name)));
      }
      const problems = validatePrescription(input.prescription);
      if (problems.length > 0) fail(...problems);
    }

    // 3 ─ bloqueo pesimista de inventario
    const ids = lines.map((line) => line.medicationId);
    const stock = await db.query<{ medication_id: number; available: number }>(
      `SELECT medication_id, available FROM inventory
        WHERE medication_id = ANY($1::int[])
        ORDER BY medication_id
        FOR UPDATE`,
      [ids],
      'lock inventario',
    );

    // 4 ─ invariante: stock
    const shortages = findStockShortages(lines, new Map(stock.map((row) => [row.medication_id, row.available])));
    if (shortages.length > 0) fail(...shortages);

    // 5 ─ reserva + orden
    const reserved = await db.query<{ medication_id: number; available: number }>(
      `UPDATE inventory i
          SET available = i.available - x.quantity,
              reserved  = i.reserved + x.quantity,
              version   = i.version + 1,
              updated_at = now()
         FROM unnest($1::int[], $2::int[]) AS x(medication_id, quantity)
        WHERE i.medication_id = x.medication_id
      RETURNING i.medication_id, i.available`,
      [ids, lines.map((line) => line.quantity)],
      'reserva stock',
    );

    const total = orderTotal(lines);
    const [order] = await db.query<{ id: string; created_at: Date }>(
      `INSERT INTO orders (patient_id, cart_id, status, total) VALUES ($1, $2, 'PENDING_APPROVAL', $3)
       RETURNING id, created_at`,
      [patient.id, cart.id, total],
    );
    await db.query(
      `INSERT INTO order_items (order_id, medication_id, quantity, unit_price, requires_prescription)
       SELECT $1, * FROM unnest($2::int[], $3::int[], $4::numeric[], $5::boolean[])`,
      [
        order.id,
        ids,
        lines.map((line) => line.quantity),
        lines.map((line) => line.unitPrice),
        lines.map((line) => line.requiresPrescription),
      ],
    );

    const prescription = needsPrescription ? input.prescription! : null;
    if (prescription) {
      await db.query(
        `INSERT INTO prescriptions (order_id, doctor_name, doctor_license, prescription_code, issued_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, prescription.doctorName.trim(), prescription.doctorLicense.trim(), prescription.prescriptionCode.trim(), prescription.issuedAt],
      );
    }
    await db.query(`UPDATE carts SET status = 'CHECKED_OUT', updated_at = now() WHERE id = $1`, [cart.id]);

    // 6 ─ eventos (outbox)
    const quantities = new Map(lines.map((line) => [line.medicationId, line.quantity]));
    const events = await appendEvents(db, [
      {
        type: 'OrderPlaced',
        orderId: order.id,
        version: 1,
        patientId: patient.id,
        patientName: patient.fullName,
        total,
        items: lines,
        requiresPrescription: needsPrescription,
        prescription: prescription && {
          doctorName: prescription.doctorName.trim(),
          doctorLicense: prescription.doctorLicense.trim(),
          prescriptionCode: prescription.prescriptionCode.trim(),
          issuedAt: prescription.issuedAt,
          status: 'PENDING_REVIEW',
        },
        placedAt: order.created_at.toISOString(),
      },
      {
        type: 'InventoryReserved',
        orderId: order.id,
        items: reserved.map((row) => ({
          medicationId: row.medication_id,
          quantity: quantities.get(row.medication_id)!,
          available: row.available,
        })),
      },
    ]);

    return {
      value: {
        orderId: order.id,
        status: 'PENDING_APPROVAL',
        total,
        itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        requiresPrescription: needsPrescription,
        acceptedAt: order.created_at,
      },
      events,
    };
  });
}
