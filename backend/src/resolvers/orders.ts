import type { GraphQLContext } from '../shared/context.js';
import { fromCents, toCents } from '../shared/money.js';
import { findOpenCart, type CartView } from '../read/repositories/cartReadRepo.js';
import {
  findOrderById,
  findOrdersByPatient,
  findPharmacyQueue,
  type OrderItemView,
  type OrderRow,
} from '../read/repositories/orderReadRepo.js';
import type { UserRow } from '../read/loaders/index.js';
import type { CatalogRow } from '../read/repositories/catalogReadRepo.js';
import { requireUser } from './helpers.js';

type CartItem = CartView['items'][number];

async function cartMedications(cart: CartView, ctx: GraphQLContext): Promise<CatalogRow[]> {
  const rows = await ctx.loaders.medication.loadMany(cart.items.map((item) => item.medicationId));
  return rows.filter((row): row is CatalogRow => row !== null && !(row instanceof Error));
}

/** Resolvers de LECTURA de pedidos, carrito y usuario. */
export const orderResolvers = {
  Query: {
    me: (_: unknown, __: unknown, ctx: GraphQLContext) => (ctx.user ? ctx.loaders.user.load(ctx.user.id) : null),

    myCart: (_: unknown, __: unknown, ctx: GraphQLContext) => findOpenCart(ctx.db, requireUser(ctx, 'PATIENT').id),

    myOrders: (_: unknown, { status }: { status?: string | null }, ctx: GraphQLContext) =>
      findOrdersByPatient(ctx.db, requireUser(ctx, 'PATIENT').id, status),

    async order(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      const user = requireUser(ctx);
      const order = await findOrderById(ctx.db, id);
      // null también mientras la proyección aún no existe (consistencia eventual).
      if (!order || (user.role === 'PATIENT' && order.patient_id !== user.id)) return null;
      return order;
    },

    pharmacyQueue: (_: unknown, { statuses }: { statuses: string[] }, ctx: GraphQLContext) => {
      requireUser(ctx, 'PHARMACIST');
      return findPharmacyQueue(ctx.db, statuses);
    },
  },

  User: {
    fullName: (user: UserRow | { fullName: string }) => ('fullName' in user ? user.fullName : user.full_name),
  },

  Cart: {
    itemCount: (cart: CartView) => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    async subtotal(cart: CartView, _: unknown, ctx: GraphQLContext) {
      const prices = new Map((await cartMedications(cart, ctx)).map((row) => [row.medication_id, row.price]));
      return fromCents(cart.items.reduce((sum, item) => sum + toCents(prices.get(item.medicationId) ?? 0) * item.quantity, 0));
    },
    requiresPrescription: async (cart: CartView, _: unknown, ctx: GraphQLContext) =>
      (await cartMedications(cart, ctx)).some((row) => row.requires_prescription),
  },

  CartItem: {
    medication: (item: CartItem, _: unknown, ctx: GraphQLContext) => ctx.loaders.medication.load(item.medicationId),
    async lineTotal(item: CartItem, _: unknown, ctx: GraphQLContext) {
      const medication = await ctx.loaders.medication.load(item.medicationId);
      return fromCents(toCents(medication?.price ?? 0) * item.quantity);
    },
  },

  Order: {
    id: (order: OrderRow) => order.order_id,
    statusReason: (order: OrderRow) => order.status_reason,
    itemCount: (order: OrderRow) => order.item_count,
    requiresPrescription: (order: OrderRow) => order.requires_prescription,
    patient: (order: OrderRow, _: unknown, ctx: GraphQLContext) => ctx.loaders.user.load(order.patient_id),
    placedAt: (order: OrderRow) => order.placed_at,
    updatedAt: (order: OrderRow) => order.updated_at,
    projectionVersion: (order: OrderRow) => order.projection_version,
  },

  OrderLine: {
    medication: (line: OrderItemView, _: unknown, ctx: GraphQLContext) => ctx.loaders.medication.load(line.medicationId),
    medicationName: (line: OrderItemView) => line.name,
    lineTotal: (line: OrderItemView) => fromCents(toCents(line.unitPrice) * line.quantity),
  },
};
