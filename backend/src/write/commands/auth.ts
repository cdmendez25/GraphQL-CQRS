import bcrypt from 'bcryptjs';
import { signToken, type AuthUser } from '../../shared/auth.js';
import { createDb } from '../../shared/db.js';
import { DomainErrors, fail, type DomainError } from '../domain/errors.js';
import type { CommandContext, HandlerOutput } from '../types.js';

export interface Session {
  token: string;
  user: AuthUser;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: AuthUser['role'];
  password_hash: string;
}

const toAuthUser = (row: UserRow): AuthUser => ({ id: row.id, email: row.email, fullName: row.full_name, role: row.role });

/** Autenticación también por GraphQL (Zero-REST): emite un JWT. */
export async function login(input: { email: string; password: string }, ctx: CommandContext): Promise<HandlerOutput<Session>> {
  const db = createDb(ctx.stats);
  const [row] = await db.query<UserRow>(
    `SELECT id, email, full_name, role, password_hash FROM users WHERE email = lower($1)`,
    [input.email.trim()],
  );
  if (!row || !(await bcrypt.compare(input.password, row.password_hash))) fail(DomainErrors.invalidCredentials());
  const user = toAuthUser(row);
  return { value: { token: signToken(user), user }, events: [] };
}

export async function registerPatient(
  input: { email: string; fullName: string; password: string },
  ctx: CommandContext,
): Promise<HandlerOutput<Session>> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const errors: DomainError[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(DomainErrors.validation('email', 'Correo electrónico inválido.'));
  if (fullName.length < 3) errors.push(DomainErrors.validation('fullName', 'Escribe tu nombre completo.'));
  if (input.password.length < 8) errors.push(DomainErrors.validation('password', 'La contraseña debe tener al menos 8 caracteres.'));
  if (errors.length > 0) fail(...errors);

  const db = createDb(ctx.stats);
  const hash = await bcrypt.hash(input.password, 10);
  const [row] = await db.query<UserRow>(
    `INSERT INTO users (email, full_name, password_hash, role) VALUES ($1, $2, $3, 'PATIENT')
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, full_name, role, password_hash`,
    [email, fullName, hash],
  );
  if (!row) fail(DomainErrors.validation('email', 'Ya existe una cuenta con ese correo.'));
  const user = toAuthUser(row);
  return { value: { token: signToken(user), user }, events: [] };
}
