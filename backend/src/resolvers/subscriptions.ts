import { withFilter } from 'graphql-subscriptions';
import type { GraphQLContext } from '../shared/context.js';
import { pubsub, TOPICS } from '../shared/pubsub.js';
import type { OrderRow } from '../read/repositories/orderReadRepo.js';
import type { CatalogRow } from '../read/repositories/catalogReadRepo.js';
import { requireUser } from './helpers.js';

/**
 * Las subscriptions se alimentan del PROYECTOR: solo se emite cuando el read
 * model ya refleja el cambio, así el cliente nunca recibe algo que luego no
 * pueda volver a consultar con una Query.
 */
export const subscriptionResolvers = {
  Subscription: {
    orderStatusChanged: {
      subscribe: (root: unknown, args: { orderId?: string | null }, ctx: GraphQLContext, info: unknown) => {
        requireUser(ctx);
        return withFilter<{ orderStatusChanged: OrderRow }, { orderId?: string | null }, GraphQLContext>(
          () => pubsub.asyncIterableIterator(TOPICS.ORDER_UPDATED),
          (payload: { orderStatusChanged: OrderRow } | undefined, variables: { orderId?: string | null } | undefined, context: GraphQLContext | undefined) => {
            const order = payload?.orderStatusChanged;
            const user = context?.user;
            if (!order || !user) return false;
            if (variables?.orderId && order.order_id !== variables.orderId) return false;
            return user.role === 'PHARMACIST' || order.patient_id === user.id;
          },
        )(root as never, args, ctx, info as never);
      },
    },

    stockChanged: {
      subscribe: withFilter<{ stockChanged: CatalogRow }, { medicationIds?: string[] | null }>(
        () => pubsub.asyncIterableIterator(TOPICS.STOCK_CHANGED),
        (payload: { stockChanged: CatalogRow } | undefined, variables: { medicationIds?: string[] | null } | undefined) =>
          !!payload && (!variables?.medicationIds?.length || variables.medicationIds.includes(String(payload.stockChanged.medication_id))),
      ),
    },
  },
};
