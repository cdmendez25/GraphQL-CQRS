import type { Db } from '../shared/db.js';
import type { OrderLineDraft, OrderStatus } from './domain/order.js';

type PrescriptionState = 'PENDING_REVIEW' | 'AUTO_VERIFIED' | 'APPROVED' | 'REJECTED';

/** Eventos de dominio: hechos ya ocurridos, en pasado. Son el puente write → read. */
export type DomainEvent =
  | {
      type: 'OrderPlaced';
      orderId: string;
      version: number;
      patientId: string;
      patientName: string;
      total: string;
      items: OrderLineDraft[];
      requiresPrescription: boolean;
      prescription: {
        doctorName: string;
        doctorLicense: string;
        prescriptionCode: string;
        issuedAt: string;
        status: PrescriptionState;
      } | null;
      placedAt: string;
    }
  | { type: 'PrescriptionVerified'; orderId: string; version: number; notes: string }
  | { type: 'OrderApproved'; orderId: string; version: number; approvedBy: string; notes: string | null; prescriptionStatus: PrescriptionState | null }
  | { type: 'OrderDispatched'; orderId: string; version: number; dispatchedBy: string }
  | { type: 'OrderCancelled'; orderId: string; version: number; from: OrderStatus; cancelledBy: string; reason: string; prescriptionStatus: PrescriptionState | null }
  /** `available` es el valor ABSOLUTO resultante → aplicar el evento es idempotente. */
  | { type: 'InventoryReserved'; orderId: string; items: { medicationId: number; quantity: number; available: number }[] }
  | { type: 'InventoryReleased'; orderId: string; items: { medicationId: number; quantity: number; available: number }[] };

export type PersistedEvent = DomainEvent & { id: number; occurredAt: string };

const aggregateOf = (event: DomainEvent) =>
  event.type.startsWith('Inventory') ? { type: 'Inventory', id: event.orderId } : { type: 'Order', id: event.orderId };

/** Guarda los eventos en el outbox dentro de la transacción del comando. */
export async function appendEvents(db: Db, events: DomainEvent[]): Promise<PersistedEvent[]> {
  const persisted: PersistedEvent[] = [];
  for (const event of events) {
    const aggregate = aggregateOf(event);
    const [row] = await db.query<{ id: number; occurred_at: Date }>(
      `INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1, $2, $3, $4) RETURNING id, occurred_at`,
      [aggregate.type, aggregate.id, event.type, JSON.stringify(event)],
      'outbox',
    );
    persisted.push({ ...event, id: row.id, occurredAt: row.occurred_at.toISOString() });
  }
  return persisted;
}
