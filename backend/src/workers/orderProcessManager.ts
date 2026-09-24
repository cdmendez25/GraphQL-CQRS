import { SYSTEM_ACTOR } from '../shared/auth.js';
import { env } from '../shared/config.js';
import { createDb, newStats } from '../shared/db.js';
import { eventBus } from '../shared/eventBus.js';
import { dispatch } from '../write/commandBus.js';

type Followup =
  | { command: 'ApproveOrder'; input: { orderId: string; notes: string } }
  | { command: 'VerifyPrescription'; input: { orderId: string } };

function schedule(delayMs: number, followup: Followup) {
  setTimeout(() => {
    const ctx = { actor: SYSTEM_ACTOR, stats: newStats('sys') };
    const run = followup.command === 'ApproveOrder'
      ? dispatch('ApproveOrder', followup.input, ctx)
      : dispatch('VerifyPrescription', followup.input, ctx);
    run.catch((error) => console.error(`[ProcessManager] ✖ ${followup.command}`, error));
  }, delayMs).unref();
}

const autoApprove = (orderId: string): Followup => ({
  command: 'ApproveOrder',
  input: { orderId, notes: 'Aprobación automática: pedido sin medicamentos de control.' },
});

/**
 * Process manager (saga) del pedido: reacciona a eventos con nuevos comandos.
 *  · OrderPlaced sin fórmula → ApproveOrder automático (SYSTEM).
 *  · OrderPlaced con fórmula → VerifyPrescription asíncrono; luego el
 *    químico farmacéutico decide (approveOrder / rejectOrder).
 */
export async function startOrderProcessManager() {
  eventBus.onCommitted((events) => {
    for (const event of events) {
      if (event.type !== 'OrderPlaced') continue;
      if (event.requiresPrescription) {
        console.log(`[ProcessManager] pedido ${event.orderId.slice(0, 8)} con fórmula → verificación en ${env.prescriptionCheckDelayMs}ms`);
        schedule(env.prescriptionCheckDelayMs, { command: 'VerifyPrescription', input: { orderId: event.orderId } });
      } else {
        console.log(`[ProcessManager] pedido ${event.orderId.slice(0, 8)} OTC → aprobación automática en ${env.autoApprovalDelayMs}ms`);
        schedule(env.autoApprovalDelayMs, autoApprove(event.orderId));
      }
    }
  });

  // Recuperación tras reinicio: retoma pedidos que quedaron esperando un paso automático.
  const db = createDb(newStats('sys', true));
  const pending = await db.query<{ id: string; prescription_status: string | null; has_controlled: boolean }>(
    `SELECT o.id, p.status AS prescription_status,
            EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.requires_prescription) AS has_controlled
       FROM orders o LEFT JOIN prescriptions p ON p.order_id = o.id
      WHERE o.status = 'PENDING_APPROVAL'`,
  );
  for (const order of pending) {
    if (!order.has_controlled) schedule(env.autoApprovalDelayMs, autoApprove(order.id));
    else if (order.prescription_status === 'PENDING_REVIEW') {
      schedule(env.prescriptionCheckDelayMs, { command: 'VerifyPrescription', input: { orderId: order.id } });
    }
  }
  if (pending.length > 0) console.log(`[ProcessManager] retomando ${pending.length} pedido(s) pendiente(s)`);
}
