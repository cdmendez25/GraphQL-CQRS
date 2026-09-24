import { GraphQLError } from 'graphql';
import type { AuthUser, UserRole } from '../shared/auth.js';
import type { GraphQLContext } from '../shared/context.js';

export const badInput = (message: string) => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

/** ID de GraphQL (string) → id numérico del catálogo. */
export function toIntId(value: string | number, field = 'id'): number {
  const text = String(value);
  if (!/^\d{1,9}$/.test(text)) throw badInput(`${field}: "${text}" no es un ID válido.`);
  return Number(text);
}

/** Las Queries privadas exigen sesión; los errores de autorización de lectura van como errores GraphQL. */
export function requireUser(ctx: GraphQLContext, role?: UserRole): AuthUser {
  if (!ctx.user) throw new GraphQLError('Debes iniciar sesión.', { extensions: { code: 'UNAUTHENTICATED' } });
  if (role && ctx.user.role !== role) {
    throw new GraphQLError('No tienes permiso para ver este recurso.', { extensions: { code: 'FORBIDDEN' } });
  }
  return ctx.user;
}

/** Fusiona los mapas de resolvers de cada módulo (Query/Mutation/tipos). */
export function mergeResolvers(...maps: Record<string, object>[]) {
  const merged: Record<string, object> = {};
  for (const map of maps) {
    for (const [type, fields] of Object.entries(map)) {
      merged[type] = { ...(merged[type] ?? {}), ...fields };
    }
  }
  return merged;
}
