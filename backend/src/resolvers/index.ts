import { scalarResolvers } from '../shared/scalars.js';
import { catalogResolvers } from './catalog.js';
import { mergeResolvers } from './helpers.js';
import { mutationResolvers } from './mutations.js';
import { orderResolvers } from './orders.js';
import { subscriptionResolvers } from './subscriptions.js';

export const resolvers = {
  ...mergeResolvers(catalogResolvers, orderResolvers, mutationResolvers, subscriptionResolvers),
  ...scalarResolvers,
};
