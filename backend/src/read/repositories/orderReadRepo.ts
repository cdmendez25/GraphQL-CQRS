import type { Db } from '../../shared/db.js';

export interface OrderItemView {
  medicationId: number;
  name: string;
  presentation: string;
  quantity: number;
  unitPrice: string;
  requiresPrescription: boolean;
}

export interface PrescriptionView {
  doctorName: string;
  doctorLicense: string;
  prescriptionCode: string;
  issuedAt: string;
  status: string;
  notes?: string | null;
}

/** Fila de order_summary_projection. */
export interface OrderRow {
  order_id: string;
  patient_id: string;
  patient_name: string;
  status: string;
  status_reason: string | null;
  total: string;
  item_count: number;
  items: OrderItemView[];
  requires_prescription: boolean;
  prescription: PrescriptionView | null;
  projection_version: number;
  placed_at: Date;
  updated_at: Date;
}

const COLUMNS = `order_id, patient_id, patient_name, status, status_reason, total, item_count, items,
  requires_prescription, prescription, projection_version, placed_at, updated_at`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findOrderById(db: Db, orderId: string): Promise<OrderRow | null> {
  if (!UUID.test(orderId)) return null;
  const [row] = await db.query<OrderRow>(`SELECT ${COLUMNS} FROM order_summary_projection WHERE order_id = $1`, [orderId], 'pedido');
  return row ?? null;
}

export function findOrdersByPatient(db: Db, patientId: string, status?: string | null): Promise<OrderRow[]> {
  return db.query<OrderRow>(
    `SELECT ${COLUMNS} FROM order_summary_projection
      WHERE patient_id = $1 AND ($2::order_status IS NULL OR status = $2::order_status)
      ORDER BY placed_at DESC`,
    [patientId, status ?? null],
    'mis pedidos',
  );
}

/** Cola del farmacéutico: lo más antiguo primero (FIFO). */
export function findPharmacyQueue(db: Db, statuses: string[]): Promise<OrderRow[]> {
  return db.query<OrderRow>(
    `SELECT ${COLUMNS} FROM order_summary_projection
      WHERE status = ANY($1::order_status[])
      ORDER BY placed_at ASC`,
    [statuses],
    'cola farmacia',
  );
}
