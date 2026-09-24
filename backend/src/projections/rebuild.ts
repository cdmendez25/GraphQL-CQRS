import { withTransaction, type Db, type QueryStats } from '../shared/db.js';
import { normalizeText } from '../shared/text.js';
import type { PersistedEvent } from '../write/events.js';
import { applyEvent, emptyTouched } from './applyEvent.js';
import { CHECKPOINT } from './projector.js';

/** Construye catalog_projection desde el write model (una sola consulta INSERT … SELECT jsonb). */
async function rebuildCatalog(db: Db, lastEventId: number) {
  const rows = await db.query<{
    id: number;
    commercial_name: string;
    active_ingredient: string;
    category: string;
  }>(
    `SELECT m.id, m.commercial_name, ai.name AS active_ingredient, c.name AS category
       FROM medications m
       JOIN active_ingredients ai ON ai.id = m.active_ingredient_id
       JOIN therapeutic_categories c ON c.id = m.category_id`,
  );
  const searchText = rows.map((row) => ({
    id: row.id,
    search_text: normalizeText(`${row.commercial_name} ${row.active_ingredient} ${row.category}`),
  }));

  await db.query(
    `INSERT INTO catalog_projection
       (medication_id, sku, commercial_name, active_ingredient_id, active_ingredient, category_id, category,
        category_slug, laboratory_id, laboratory, dosage, presentation, price, requires_prescription,
        description, stock_available, search_text, last_event_id, updated_at)
     SELECT m.id, m.sku, m.commercial_name, ai.id, ai.name, c.id, c.name, c.slug, l.id, l.name,
            m.dosage, m.presentation, m.price, m.requires_prescription, m.description, i.available,
            s.search_text, $2, now()
       FROM medications m
       JOIN active_ingredients ai ON ai.id = m.active_ingredient_id
       JOIN therapeutic_categories c ON c.id = m.category_id
       JOIN laboratories l ON l.id = m.laboratory_id
       JOIN inventory i ON i.medication_id = m.id
       JOIN jsonb_to_recordset($1::jsonb) AS s(id int, search_text text) ON s.id = m.id`,
    [JSON.stringify(searchText), lastEventId],
    'rebuild catálogo',
  );
  return rows.length;
}

/**
 * Reconstruye TODO el read model:
 *  · catálogo → desde el estado actual del write model
 *  · pedidos  → re-aplicando (replay) todos los eventos del outbox
 * Demuestra que las proyecciones son desechables y derivables.
 */
export async function rebuildProjections(stats: QueryStats) {
  return withTransaction(stats, async (db) => {
    await db.query(`INSERT INTO projection_checkpoints (projection) VALUES ($1) ON CONFLICT DO NOTHING`, [CHECKPOINT]);
    await db.query(`SELECT 1 FROM projection_checkpoints WHERE projection = $1 FOR UPDATE`, [CHECKPOINT]);
    const [{ max }] = await db.query<{ max: number }>(`SELECT COALESCE(MAX(id), 0)::bigint AS max FROM domain_events`);

    await db.query(`TRUNCATE catalog_projection, order_summary_projection`);
    const medications = await rebuildCatalog(db, max);

    const events = await db.query<{ id: number; payload: PersistedEvent; occurred_at: Date }>(
      `SELECT id, payload, occurred_at FROM domain_events ORDER BY id`,
    );
    const touched = emptyTouched();
    for (const row of events) {
      await applyEvent(db, { ...row.payload, id: row.id, occurredAt: row.occurred_at.toISOString() }, touched);
    }
    await db.query(`UPDATE projection_checkpoints SET last_event_id = $2, updated_at = now() WHERE projection = $1`, [CHECKPOINT, max]);
    return { medications, orders: touched.orders.size, events: events.length };
  });
}
