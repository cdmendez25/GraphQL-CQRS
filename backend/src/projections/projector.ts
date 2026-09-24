import { env } from '../shared/config.js';
import { createDb, newStats, withTransaction } from '../shared/db.js';
import { eventBus } from '../shared/eventBus.js';
import { pubsub, TOPICS } from '../shared/pubsub.js';
import { sleep } from '../shared/text.js';
import { CATALOG_COLUMNS, type CatalogRow } from '../read/repositories/catalogReadRepo.js';
import { findOrderById } from '../read/repositories/orderReadRepo.js';
import type { PersistedEvent } from '../write/events.js';
import { applyEvent, emptyTouched } from './applyEvent.js';

const BATCH_SIZE = 100;
export const CHECKPOINT = 'main';

/**
 * Proyector asíncrono: lee domain_events posteriores al checkpoint, actualiza
 * las tablas *_projection y, tras el COMMIT, publica en las subscriptions.
 *
 * Entre el COMMIT del comando y la actualización de la proyección hay una
 * ventana (PROJECTION_DELAY_MS) → consistencia eventual observable en la UI.
 */
export class Projector {
  private running = false;
  private pendingWake = false;

  start() {
    eventBus.onCommitted(() => this.wake());
    this.wake(); // ponerse al día con eventos que hayan quedado sin proyectar
  }

  wake() {
    if (this.running) {
      this.pendingWake = true;
      return;
    }
    this.running = true;
    void this.drain();
  }

  private async drain() {
    try {
      do {
        this.pendingWake = false;
        if (env.projectionDelayMs > 0) await sleep(env.projectionDelayMs);
        while ((await this.processBatch()) === BATCH_SIZE) {
          /* seguir hasta vaciar la cola */
        }
      } while (this.pendingWake);
    } catch (error) {
      console.error('[Projector] ✖ error aplicando eventos, reintento en 5s', error);
      setTimeout(() => this.wake(), 5000);
    } finally {
      this.running = false;
    }
  }

  /** Aplica hasta BATCH_SIZE eventos en una transacción. Devuelve cuántos aplicó. */
  private async processBatch(): Promise<number> {
    const stats = newStats('proj', true);
    const touched = emptyTouched();

    const applied = await withTransaction(stats, async (db) => {
      await db.query(`INSERT INTO projection_checkpoints (projection) VALUES ($1) ON CONFLICT DO NOTHING`, [CHECKPOINT]);
      const [checkpoint] = await db.query<{ last_event_id: number }>(
        `SELECT last_event_id FROM projection_checkpoints WHERE projection = $1 FOR UPDATE`,
        [CHECKPOINT],
      );
      const rows = await db.query<{ id: number; payload: PersistedEvent; occurred_at: Date }>(
        `SELECT id, payload, occurred_at FROM domain_events WHERE id > $1 ORDER BY id LIMIT $2`,
        [checkpoint.last_event_id, BATCH_SIZE],
        'eventos pendientes',
      );
      if (rows.length === 0) return [];

      for (const row of rows) {
        await applyEvent(db, { ...row.payload, id: row.id, occurredAt: row.occurred_at.toISOString() }, touched);
      }
      await db.query(`UPDATE projection_checkpoints SET last_event_id = $2, updated_at = now() WHERE projection = $1`, [
        CHECKPOINT,
        rows.at(-1)!.id,
      ]);
      return rows;
    });

    if (applied.length > 0) {
      console.log(
        `[Projector] ✔ ${applied.length} evento(s) #${applied[0].id}…#${applied.at(-1)!.id} → ` +
          `${touched.orders.size} pedido(s), ${touched.medications.size} medicamento(s) actualizados en el read model`,
      );
      await this.publish(touched.orders, touched.medications);
    }
    return applied.length;
  }

  /** Notifica a los clientes suscritos con la proyección YA actualizada. */
  private async publish(orderIds: Set<string>, medicationIds: Set<number>) {
    const db = createDb(newStats('pub', true));
    for (const orderId of orderIds) {
      const order = await findOrderById(db, orderId);
      if (order) await pubsub.publish(TOPICS.ORDER_UPDATED, { orderStatusChanged: order });
    }
    if (medicationIds.size > 0) {
      const rows = await db.query<CatalogRow>(
        `SELECT ${CATALOG_COLUMNS} FROM catalog_projection WHERE medication_id = ANY($1::int[])`,
        [[...medicationIds]],
      );
      for (const row of rows) await pubsub.publish(TOPICS.STOCK_CHANGED, { stockChanged: row });
    }
  }
}
