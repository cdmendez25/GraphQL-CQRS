import { withTransaction, type Db } from '../../shared/db.js';
import { DomainErrors, fail } from '../domain/errors.js';
import { requirePatient, type CommandContext, type HandlerOutput } from '../types.js';

export interface CartState {
  id: string;
  items: { medicationId: number; quantity: number }[];
}

const MAX_UNITS_PER_ITEM = 999;

/** Bloquea (FOR UPDATE) el carrito abierto del paciente; opcionalmente lo crea. */
async function lockOpenCart(db: Db, patientId: string, createIfMissing: boolean): Promise<string | null> {
  if (createIfMissing) {
    await db.query(
      `INSERT INTO carts (patient_id) VALUES ($1)
       ON CONFLICT (patient_id) WHERE status = 'OPEN' DO NOTHING`,
      [patientId],
    );
  }
  const [cart] = await db.query<{ id: string }>(
    `SELECT id FROM carts WHERE patient_id = $1 AND status = 'OPEN' FOR UPDATE`,
    [patientId],
  );
  return cart?.id ?? null;
}

export async function loadCart(db: Db, cartId: string): Promise<CartState> {
  const items = await db.query<{ medication_id: number; quantity: number }>(
    `SELECT medication_id, quantity FROM cart_items WHERE cart_id = $1 ORDER BY added_at, medication_id`,
    [cartId],
  );
  return { id: cartId, items: items.map((row) => ({ medicationId: row.medication_id, quantity: row.quantity })) };
}

async function medicationStock(db: Db, medicationId: number) {
  const [row] = await db.query<{ name: string; available: number }>(
    `SELECT m.commercial_name AS name, i.available
       FROM medications m JOIN inventory i ON i.medication_id = m.id
      WHERE m.id = $1`,
    [medicationId],
  );
  return row ?? fail(DomainErrors.notFound('Medicamento', medicationId));
}

/**
 * Verificación temprana de stock para dar feedback inmediato. La garantía
 * definitiva (con bloqueo de filas) ocurre en checkoutCart.
 */
function ensureQuantity(medicationId: number, name: string, quantity: number, available: number) {
  if (quantity > MAX_UNITS_PER_ITEM) {
    fail(DomainErrors.validation('quantity', `Máximo ${MAX_UNITS_PER_ITEM} unidades por medicamento.`));
  }
  if (quantity > available) fail(DomainErrors.outOfStock(medicationId, name, quantity, available));
}

export async function addItemToCart(
  input: { medicationId: number; quantity: number },
  ctx: CommandContext,
): Promise<HandlerOutput<CartState>> {
  const patient = requirePatient(ctx.actor);
  return withTransaction(ctx.stats, async (db) => {
    const medication = await medicationStock(db, input.medicationId);
    const cartId = (await lockOpenCart(db, patient.id, true))!;
    const [existing] = await db.query<{ quantity: number }>(
      `SELECT quantity FROM cart_items WHERE cart_id = $1 AND medication_id = $2`,
      [cartId, input.medicationId],
    );
    const quantity = (existing?.quantity ?? 0) + input.quantity;
    ensureQuantity(input.medicationId, medication.name, quantity, medication.available);

    await db.query(
      `INSERT INTO cart_items (cart_id, medication_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, medication_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [cartId, input.medicationId, quantity],
    );
    await db.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [cartId]);
    return { value: await loadCart(db, cartId), events: [] };
  });
}

export async function updateCartItemQuantity(
  input: { medicationId: number; quantity: number },
  ctx: CommandContext,
): Promise<HandlerOutput<CartState>> {
  const patient = requirePatient(ctx.actor);
  return withTransaction(ctx.stats, async (db) => {
    const cartId = (await lockOpenCart(db, patient.id, false)) ?? fail(DomainErrors.notFound('Carrito', 'abierto'));
    const medication = await medicationStock(db, input.medicationId);
    ensureQuantity(input.medicationId, medication.name, input.quantity, medication.available);

    const updated = await db.query(
      `UPDATE cart_items SET quantity = $3 WHERE cart_id = $1 AND medication_id = $2 RETURNING medication_id`,
      [cartId, input.medicationId, input.quantity],
    );
    if (updated.length === 0) fail(DomainErrors.notFound('Ítem del carrito', input.medicationId));
    await db.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [cartId]);
    return { value: await loadCart(db, cartId), events: [] };
  });
}

export async function removeItemFromCart(
  input: { medicationId: number },
  ctx: CommandContext,
): Promise<HandlerOutput<CartState>> {
  const patient = requirePatient(ctx.actor);
  return withTransaction(ctx.stats, async (db) => {
    const cartId = (await lockOpenCart(db, patient.id, false)) ?? fail(DomainErrors.notFound('Carrito', 'abierto'));
    const deleted = await db.query(
      `DELETE FROM cart_items WHERE cart_id = $1 AND medication_id = $2 RETURNING medication_id`,
      [cartId, input.medicationId],
    );
    if (deleted.length === 0) fail(DomainErrors.notFound('Ítem del carrito', input.medicationId));
    await db.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [cartId]);
    return { value: await loadCart(db, cartId), events: [] };
  });
}
