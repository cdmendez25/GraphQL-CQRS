import { PubSub } from 'graphql-subscriptions';

/** Canal en memoria para GraphQL Subscriptions (lo alimenta el proyector). */
export const pubsub = new PubSub();

export const TOPICS = {
  ORDER_UPDATED: 'ORDER_UPDATED',
  STOCK_CHANGED: 'STOCK_CHANGED',
} as const;
