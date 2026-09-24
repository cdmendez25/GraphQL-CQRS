import type { Db } from '../../shared/db.js';

export interface CartView {
  id: string;
  items: { medicationId: number; quantity: number }[];
}

/**
 * El carrito es un agregado de vida corta que el propio paciente edita, así
 * que se lee con consistencia fuerte (read-your-own-writes) desde sus tablas.
 * Los datos de cada medicamento (nombre, precio, stock) sí vienen del read
 * model vía DataLoader.
 */
export async function findOpenCart(db: Db, patientId: string): Promise<CartView | null> {
  const rows = await db.query<{ id: string; medication_id: number | null; quantity: number | null }>(
    `SELECT c.id, ci.medication_id, ci.quantity
       FROM carts c LEFT JOIN cart_items ci ON ci.cart_id = c.id
      WHERE c.patient_id = $1 AND c.status = 'OPEN'
      ORDER BY ci.added_at, ci.medication_id`,
    [patientId],
    'carrito',
  );
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    items: rows
      .filter((row) => row.medication_id !== null)
      .map((row) => ({ medicationId: row.medication_id!, quantity: row.quantity! })),
  };
}
