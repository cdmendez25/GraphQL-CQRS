import jwt from 'jsonwebtoken';
import { env } from './config.js';

export type UserRole = 'PATIENT' | 'PHARMACIST';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

/** Actor que ejecuta un comando: un usuario autenticado o el propio sistema (workers). */
export type Actor = AuthUser | { id: 'system'; role: 'SYSTEM'; fullName: 'Sistema' };

export const SYSTEM_ACTOR: Actor = { id: 'system', role: 'SYSTEM', fullName: 'Sistema' };

export function signToken(user: AuthUser): string {
  return jwt.sign({ email: user.email, fullName: user.fullName, role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: '8h',
  });
}

/** Lee "Bearer <jwt>". Un token inválido o vencido equivale a no estar autenticado. */
export function userFromAuthorization(header: unknown): AuthUser | null {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as jwt.JwtPayload;
    return { id: payload.sub!, email: payload.email, fullName: payload.fullName, role: payload.role };
  } catch {
    return null;
  }
}
