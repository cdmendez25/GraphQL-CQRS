import { createLoaders, type Loaders } from '../read/loaders/index.js';
import { userFromAuthorization, type AuthUser } from './auth.js';
import { env } from './config.js';
import { createDb, newStats, type Db, type QueryStats } from './db.js';

export interface GraphQLContext {
  user: AuthUser | null;
  db: Db;
  loaders: Loaders;
  stats: QueryStats;
}

/**
 * Contexto nuevo por operación: usuario del JWT, contador de SQL y
 * DataLoaders frescos (su caché vive solo durante esta operación).
 *
 * En subscriptions la operación dura mucho (toda la conexión), por eso ahí se
 * desactiva la caché de los loaders: cada evento debe leer datos actuales.
 */
export function buildContext(authorization: unknown, kind: 'http' | 'ws' = 'http'): GraphQLContext {
  const stats = newStats(kind === 'ws' ? 'ws' : 'req');
  const db = createDb(stats);
  return {
    user: userFromAuthorization(authorization),
    stats,
    db,
    loaders: createLoaders(db, {
      batching: env.dataloaderEnabled,
      caching: env.dataloaderEnabled && kind === 'http',
    }),
  };
}
