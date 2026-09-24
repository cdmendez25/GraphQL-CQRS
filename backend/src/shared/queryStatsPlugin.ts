import type { ApolloServerPlugin } from '@apollo/server';
import type { GraphQLContext } from './context.js';

/**
 * Registra cada operación GraphQL con el número total de consultas SQL que
 * provocó. Es la evidencia para el video: con DataLoader, una consulta de
 * catálogo con laboratorio anidado cuesta 2 SQL en vez de 1 + N.
 */
export const queryStatsPlugin: ApolloServerPlugin<GraphQLContext> = {
  async requestDidStart({ contextValue }) {
    const started = performance.now();
    return {
      async didResolveOperation({ operation, operationName }) {
        if (!operation) return;
        console.log(`\n[GraphQL ${contextValue.stats.requestId}] ▶ ${operation.operation} ${operationName ?? '(anónima)'}`);
      },
      async willSendResponse({ operation, operationName }) {
        if (!operation) return;
        const ms = (performance.now() - started).toFixed(0);
        console.log(
          `[GraphQL ${contextValue.stats.requestId}] ◀ ${operation.operation} ${operationName ?? '(anónima)'} → ` +
            `${contextValue.stats.count} consulta(s) SQL · ${ms}ms`,
        );
      },
    };
  },
};
