import pg from 'pg';
import { env } from './config.js';

const { Pool, types } = pg;

// bigint (count, bigserial) → number. numeric se deja como string para no perder precisión en dinero.
types.setTypeParser(20, (value) => Number(value));
// date → 'YYYY-MM-DD' tal cual (sin conversión a zona horaria).
types.setTypeParser(1082, (value) => value);

let pool: pg.Pool | undefined;

/** Pool único hacia la PostgreSQL de Supabase (protocolo Postgres nativo, sin REST). */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = env.databaseUrl;
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      max: 10,
      // Abrir una conexión TLS contra Supabase cuesta segundos: se reutilizan en vez de cerrarlas a los 10 s.
      idleTimeoutMillis: 5 * 60_000,
      keepAlive: true,
    });
  }
  return pool;
}

export async function closePool() {
  await pool?.end();
  pool = undefined;
}

/** Métricas por request GraphQL: permite demostrar cuántas consultas SQL provoca cada operación. */
export interface QueryStats {
  requestId: string;
  count: number;
  /** true → no imprime cada SQL (procesos internos que ya tienen su propio log resumido). */
  quiet?: boolean;
}

export function newStats(prefix = 'req', quiet = false): QueryStats {
  return { requestId: `${prefix}-${Math.random().toString(36).slice(2, 7)}`, count: 0, quiet };
}

type Executor = Pick<pg.Pool, 'query'> | pg.PoolClient;

export interface Db {
  readonly stats: QueryStats;
  query<T extends pg.QueryResultRow = any>(text: string, params?: unknown[], label?: string): Promise<T[]>;
}

const compact = (sql: string) => sql.replace(/\s+/g, ' ').trim();

/** Nunca imprimir hashes de contraseña en los logs. */
const redact = (params: unknown[]) =>
  JSON.stringify(params.map((value) => (typeof value === 'string' && /^\$2[aby]\$/.test(value) ? '[hash]' : value)));

export function createDb(stats: QueryStats, executor: Executor = getPool()): Db {
  return {
    stats,
    async query<T extends pg.QueryResultRow>(text: string, params: unknown[] = [], label?: string) {
      const started = performance.now();
      const result = await executor.query<T>(text, params);
      stats.count += 1;
      if (env.logSql && !stats.quiet) {
        const ms = (performance.now() - started).toFixed(1);
        const sql = compact(text);
        const shown = sql.length > 170 ? `${sql.slice(0, 170)}…` : sql;
        const tag = label ? ` (${label})` : '';
        console.log(`  [SQL ${stats.requestId} #${stats.count}]${tag} ${shown} ${redact(params)} · ${result.rowCount ?? 0} filas · ${ms}ms`);
      }
      return result.rows;
    },
  };
}

/**
 * Ejecuta `work` dentro de una transacción. Si lanza, se hace ROLLBACK
 * (así los command handlers garantizan atomicidad: stock + orden + eventos).
 */
export async function withTransaction<T>(stats: QueryStats, work: (db: Db) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  const db = createDb(stats, client);
  try {
    await db.query('BEGIN');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
