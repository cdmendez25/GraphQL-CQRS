import { eventBus } from '../shared/eventBus.js';
import { login, registerPatient } from './commands/auth.js';
import { addItemToCart, removeItemFromCart, updateCartItemQuantity } from './commands/cart.js';
import { checkoutCart } from './commands/checkout.js';
import { approveOrder, cancelOrder, dispatchOrder, rejectOrder, verifyPrescription } from './commands/orderLifecycle.js';
import { DomainFailure } from './domain/errors.js';
import type { CommandContext, CommandResult } from './types.js';

/**
 * Registro de comandos del write model. Cada Mutation de GraphQL se traduce
 * en exactamente un comando con intención de negocio.
 */
const handlers = {
  Login: login,
  RegisterPatient: registerPatient,
  AddItemToCart: addItemToCart,
  UpdateCartItemQuantity: updateCartItemQuantity,
  RemoveItemFromCart: removeItemFromCart,
  CheckoutCart: checkoutCart,
  ApproveOrder: approveOrder,
  RejectOrder: rejectOrder,
  DispatchOrder: dispatchOrder,
  CancelOrder: cancelOrder,
  VerifyPrescription: verifyPrescription,
};

type Handlers = typeof handlers;
export type CommandName = keyof Handlers;
type InputOf<K extends CommandName> = Parameters<Handlers[K]>[0];
type ResultOf<K extends CommandName> = Awaited<ReturnType<Handlers[K]>>['value'];

export async function dispatch<K extends CommandName>(
  name: K,
  input: InputOf<K>,
  ctx: CommandContext,
): Promise<CommandResult<ResultOf<K>>> {
  const who = ctx.actor ? `${ctx.actor.role}:${ctx.actor.fullName}` : 'anónimo';
  console.log(`[CommandBus] ▶ ${name} (${who})`);
  const handler = handlers[name] as (input: InputOf<K>, ctx: CommandContext) => Promise<{ value: ResultOf<K>; events: any[] }>;
  try {
    const { value, events } = await handler(input, ctx);
    if (events.length > 0) {
      console.log(`[CommandBus] ✔ ${name} → eventos: ${events.map((event) => `${event.type}#${event.id}`).join(', ')}`);
    } else {
      console.log(`[CommandBus] ✔ ${name}`);
    }
    // Solo después del COMMIT se avisa a proyector y process manager.
    eventBus.publishCommitted(events);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof DomainFailure) {
      console.log(`[CommandBus] ✖ ${name} rechazado: ${error.errors.map((e) => e.code).join(', ')}`);
      return { ok: false, errors: error.errors };
    }
    throw error;
  }
}
