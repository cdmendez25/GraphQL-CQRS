/**
 * Aplica en orden los archivos de supabase/migrations que aún no se han
 * ejecutado (registro en schema_migrations). Uso: npm run db:migrate
 */
import { readdirSync, readFileSync } from 'node:fs';
import { closePool, createDb, getPool, newStats } from '../src/shared/db.js';

const dir = new URL('../../supabase/migrations/', import.meta.url);
const log = (msg: string) => console.log(`[migrate] ${msg}`);

process.env.LOG_SQL = 'false';
const pool = getPool();
const db = createDb(newStats('migrate'));
await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
await db.query(`ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY`);
const applied = new Set((await db.query<{ name: string }>(`SELECT name FROM schema_migrations`)).map((row) => row.name));

for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
  if (applied.has(file)) {
    log(`= ${file} (ya aplicada)`);
    continue;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(readFileSync(new URL(file, dir), 'utf8'));
    await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
    await client.query('COMMIT');
    log(`✔ ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    log(`✖ ${file}`);
    throw error;
  } finally {
    client.release();
  }
}
await closePool();
log('listo');
