import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia backend/.env.example a backend/.env y complétala.`,
    );
  }
  return value;
}

const num = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  port: num('PORT', 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  /** false → desactiva el batching para demostrar el problema N+1 en los logs. */
  dataloaderEnabled: process.env.DATALOADER_ENABLED !== 'false',
  get logSql() {
    return process.env.LOG_SQL !== 'false';
  },
  /** Latencia artificial del proyector para hacer visible la consistencia eventual. */
  projectionDelayMs: num('PROJECTION_DELAY_MS', 1500),
  /** Tiempo que tarda el sistema en aprobar un pedido OTC (sin fórmula). */
  autoApprovalDelayMs: num('AUTO_APPROVAL_DELAY_MS', 3000),
  /** Tiempo que tarda el verificador asíncrono de fórmulas médicas. */
  prescriptionCheckDelayMs: num('PRESCRIPTION_CHECK_DELAY_MS', 4000),
};
