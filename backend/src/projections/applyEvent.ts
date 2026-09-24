import type { Db } from '../shared/db.js';
import type { PersistedEvent } from '../write/events.js';

export interface Touched {
  orders: Set<string>;
  medications: Set<number>;
}

export const emptyTouched = (): Touched => ({ orders: new Set(), medications: new Set() });

/**
 * Traduce un evento de dominio a cambios en el read model.
 * Es idempotente: las guardas `projection_version < $v` y
 * `last_event_id < $id` hacen que re-aplicar un evento no tenga efecto.
 */
export async function applyEvent(db: Db, event: PersistedEvent, touched: Touched): Promise<void> {
  switch (event.type) {
    case 'OrderPlaced': {
      await db.query(
        `INSERT INTO order_summary_projection
           (order_id, patient_id, patient_name, status, total, item_count, items, requires_prescription,
            prescription, projection_version, last_event_id, placed_at, updated_at)
         VALUES ($1, $2, $3, 'PENDING_APPROVAL', $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (order_id) DO NOTHING`,
        [
          event.orderId,
          event.patientId,
          event.patientName,
          event.total,
          event.items.reduce((sum, item) => sum + item.quantity, 0),
          JSON.stringify(event.items),
          event.requiresPrescription,
          event.prescription ? JSON.stringify(event.prescription) : null,
          event.version,
          event.id,
          event.placedAt,
          event.occurredAt,
        ],
        'proyección pedido',
      );
      touched.orders.add(event.orderId);
      return;
    }

    case 'PrescriptionVerified':
      await updateOrder(db, event, `prescription = prescription || jsonb_build_object('status', 'AUTO_VERIFIED', 'notes', $5::text)`, [event.notes]);
      touched.orders.add(event.orderId);
      return;

    case 'OrderApproved':
      await updateOrder(
        db,
        event,
        `status = 'APPROVED', status_reason = $5::text,
         prescription = CASE WHEN $6::text IS NULL THEN prescription
                             ELSE prescription || jsonb_build_object('status', $6::text)
                                  || CASE WHEN $5::text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('notes', $5::text) END
                        END`,
        [event.notes, event.prescriptionStatus],
      );
      touched.orders.add(event.orderId);
      return;

    case 'OrderDispatched':
      await updateOrder(db, event, `status = 'DISPATCHED', status_reason = NULL`, []);
      touched.orders.add(event.orderId);
      return;

    case 'OrderCancelled':
      await updateOrder(
        db,
        event,
        `status = 'CANCELLED', status_reason = $5::text,
         prescription = CASE WHEN $6::text IS NULL THEN prescription
                             ELSE prescription || jsonb_build_object('status', $6::text, 'notes', $5::text) END`,
        [event.reason, event.prescriptionStatus],
      );
      touched.orders.add(event.orderId);
      return;

    case 'InventoryReserved':
    case 'InventoryReleased': {
      const updated = await db.query<{ medication_id: number }>(
        `UPDATE catalog_projection c
            SET stock_available = x.available, last_event_id = $3, updated_at = $4
           FROM unnest($1::int[], $2::int[]) AS x(medication_id, available)
          WHERE c.medication_id = x.medication_id AND c.last_event_id < $3
        RETURNING c.medication_id`,
        [event.items.map((item) => item.medicationId), event.items.map((item) => item.available), event.id, event.occurredAt],
        'proyección stock',
      );
      updated.forEach((row) => touched.medications.add(row.medication_id));
      return;
    }
  }
}

async function updateOrder(
  db: Db,
  event: PersistedEvent & { orderId: string; version: number },
  setClause: string,
  extra: unknown[],
) {
  await db.query(
    `UPDATE order_summary_projection
        SET ${setClause}, projection_version = $2, last_event_id = $3, updated_at = $4
      WHERE order_id = $1 AND projection_version < $2`,
    [event.orderId, event.version, event.id, event.occurredAt, ...extra],
    'proyección pedido',
  );
}
