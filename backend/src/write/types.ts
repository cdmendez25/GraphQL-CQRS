import type { Actor, AuthUser } from '../shared/auth.js';
import type { QueryStats } from '../shared/db.js';
import { DomainErrors, fail, type DomainError } from './domain/errors.js';
import type { PersistedEvent } from './events.js';

export interface CommandContext {
  actor: Actor | null;
  stats: QueryStats;
}

/** Lo que devuelve un handler: su resultado + los eventos que confirmó. */
export interface HandlerOutput<R> {
  value: R;
  events: PersistedEvent[];
}

export type CommandResult<R> = { ok: true; value: R } | { ok: false; errors: DomainError[] };

export function requirePatient(actor: Actor | null): AuthUser {
  if (!actor || actor.role !== 'PATIENT') fail(DomainErrors.unauthorized('Debes iniciar sesión como paciente.'));
  return actor;
}

export function requireStaff(actor: Actor | null): Actor {
  if (!actor || (actor.role !== 'PHARMACIST' && actor.role !== 'SYSTEM')) {
    fail(DomainErrors.unauthorized('Solo un químico farmacéutico puede ejecutar esta acción.'));
  }
  return actor;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);
