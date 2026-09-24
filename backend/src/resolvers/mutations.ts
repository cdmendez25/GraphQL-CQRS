import type { GraphQLContext } from '../shared/context.js';
import { dispatch, type CommandName } from '../write/commandBus.js';
import { DomainErrors, type DomainError } from '../write/domain/errors.js';
import type { PrescriptionInput } from '../write/domain/prescription.js';
import type { CatalogRow } from '../read/repositories/catalogReadRepo.js';

type Payload = Record<string, unknown> & { errors: DomainError[] };

/**
 * Cada Mutation = 1 comando. El resolver solo traduce input GraphQL → comando
 * y resultado del comando → payload tipado. La lógica vive en el write model.
 */
async function run<K extends CommandName, R>(
  name: K,
  input: Parameters<typeof dispatch<K>>[1],
  ctx: GraphQLContext,
  toPayload: (value: any) => R,
): Promise<Payload> {
  const result = await dispatch(name, input, { actor: ctx.user, stats: ctx.stats });
  return result.ok ? { ...toPayload(result.value), errors: [] } : { errors: result.errors };
}

/** IDs numéricos inválidos se reportan como NotFoundError dentro del payload. */
const medicationIdOrError = (id: string) =>
  /^\d{1,9}$/.test(id) ? { id: Number(id) } : { error: DomainErrors.notFound('Medicamento', id) };

const cartPayload = (cart: unknown) => ({ cart });
const transitionPayload = (value: unknown) => value as Record<string, unknown>;

export const mutationResolvers = {
  Mutation: {
    login: (_: unknown, { input }: { input: { email: string; password: string } }, ctx: GraphQLContext) =>
      run('Login', input, ctx, (session) => session),

    registerPatient: (
      _: unknown,
      { input }: { input: { email: string; fullName: string; password: string } },
      ctx: GraphQLContext,
    ) => run('RegisterPatient', input, ctx, (session) => session),

    addItemToCart(_: unknown, { input }: { input: { medicationId: string; quantity: number } }, ctx: GraphQLContext) {
      const parsed = medicationIdOrError(input.medicationId);
      if (parsed.error) return { errors: [parsed.error] };
      return run('AddItemToCart', { medicationId: parsed.id, quantity: input.quantity }, ctx, cartPayload);
    },

    updateCartItemQuantity(_: unknown, { input }: { input: { medicationId: string; quantity: number } }, ctx: GraphQLContext) {
      const parsed = medicationIdOrError(input.medicationId);
      if (parsed.error) return { errors: [parsed.error] };
      return run('UpdateCartItemQuantity', { medicationId: parsed.id, quantity: input.quantity }, ctx, cartPayload);
    },

    removeItemFromCart(_: unknown, { input }: { input: { medicationId: string } }, ctx: GraphQLContext) {
      const parsed = medicationIdOrError(input.medicationId);
      if (parsed.error) return { errors: [parsed.error] };
      return run('RemoveItemFromCart', { medicationId: parsed.id }, ctx, cartPayload);
    },

    checkoutCart: (_: unknown, { input }: { input: { prescription?: PrescriptionInput | null } }, ctx: GraphQLContext) =>
      run('CheckoutCart', input, ctx, (receipt) => ({ receipt })),

    approveOrder: (_: unknown, { input }: { input: { orderId: string; notes?: string | null } }, ctx: GraphQLContext) =>
      run('ApproveOrder', input, ctx, transitionPayload),

    rejectOrder: (_: unknown, { input }: { input: { orderId: string; reason: string } }, ctx: GraphQLContext) =>
      run('RejectOrder', input, ctx, transitionPayload),

    dispatchOrder: (_: unknown, { input }: { input: { orderId: string } }, ctx: GraphQLContext) =>
      run('DispatchOrder', input, ctx, transitionPayload),

    cancelOrder: (_: unknown, { input }: { input: { orderId: string; reason?: string | null } }, ctx: GraphQLContext) =>
      run('CancelOrder', input, ctx, transitionPayload),
  },

  // ── Errores de dominio: interface + tipos concretos ──────────────────
  DomainError: {
    __resolveType: (error: DomainError) => error.kind,
  },
  OutOfStockError: {
    medication: (error: Extract<DomainError, { kind: 'OutOfStockError' }>, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.medication.load(error.medicationId),
  },
  PrescriptionRequiredError: {
    async medications(error: Extract<DomainError, { kind: 'PrescriptionRequiredError' }>, _: unknown, ctx: GraphQLContext) {
      const rows = await ctx.loaders.medication.loadMany(error.medicationIds);
      return rows.filter((row): row is CatalogRow => row !== null && !(row instanceof Error));
    },
  },
};
