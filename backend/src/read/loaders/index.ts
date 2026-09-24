import DataLoader from 'dataloader';
import type { Db } from '../../shared/db.js';
import { CATALOG_COLUMNS, type CatalogRow } from '../repositories/catalogReadRepo.js';

export interface ReferenceRow {
  id: number;
  name: string;
}
export interface CategoryRow extends ReferenceRow {
  slug: string;
}
export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: 'PATIENT' | 'PHARMACIST';
}

export interface LoaderOptions {
  /** false → cada clave dispara su propia consulta (reproduce el problema N+1). */
  batching: boolean;
  /** Caché por request: la misma clave pedida dos veces en una operación se resuelve una sola vez. */
  caching: boolean;
}

/** Reordena las filas según las claves pedidas (contrato de DataLoader). */
function orderByKeys<K, V>(keys: readonly K[], rows: V[], keyOf: (row: V) => K): (V | null)[] {
  const map = new Map(rows.map((row) => [keyOf(row), row]));
  return keys.map((key) => map.get(key) ?? null);
}

function groupByKeys<K, V>(keys: readonly K[], rows: V[], keyOf: (row: V) => K): V[][] {
  const groups = new Map<K, V[]>(keys.map((key) => [key, []]));
  for (const row of rows) groups.get(keyOf(row))?.push(row);
  return keys.map((key) => groups.get(key)!);
}

/**
 * DataLoaders por request. Durante un mismo "tick" de ejecución, GraphQL
 * resuelve todos los campos hermanos (p. ej. `laboratory` de 12 medicamentos);
 * DataLoader acumula esas claves y hace UNA consulta `WHERE id = ANY($1)`.
 * Se crean nuevos en cada request para que la caché nunca se comparta entre usuarios.
 */
export function createLoaders(db: Db, options: LoaderOptions) {
  const make = <K extends string | number, V>(name: string, load: (keys: readonly K[]) => Promise<V[]>) =>
    new DataLoader<K, V>(
      async (keys) => {
        const label = options.batching
          ? `[DataLoader ${db.stats.requestId}] ${name} ← lote de ${keys.length} clave(s) [${keys.join(', ')}] → 1 consulta`
          : `[N+1 ${db.stats.requestId}] ${name} ← clave ${keys[0]} → 1 consulta (DataLoader desactivado)`;
        console.log(label);
        return load(keys);
      },
      { batch: options.batching, cache: options.caching },
    );

  return {
    laboratory: make<number, ReferenceRow | null>('laboratory', async (ids) =>
      orderByKeys(ids, await db.query<ReferenceRow>(`SELECT id, name FROM laboratories WHERE id = ANY($1::int[])`, [ids], 'loader'), (r) => r.id),
    ),

    category: make<number, CategoryRow | null>('category', async (ids) =>
      orderByKeys(
        ids,
        await db.query<CategoryRow>(`SELECT id, name, slug FROM therapeutic_categories WHERE id = ANY($1::int[])`, [ids], 'loader'),
        (r) => r.id,
      ),
    ),

    activeIngredient: make<number, ReferenceRow | null>('activeIngredient', async (ids) =>
      orderByKeys(
        ids,
        await db.query<ReferenceRow>(`SELECT id, name FROM active_ingredients WHERE id = ANY($1::int[])`, [ids], 'loader'),
        (r) => r.id,
      ),
    ),

    medication: make<number, CatalogRow | null>('medication', async (ids) =>
      orderByKeys(
        ids,
        await db.query<CatalogRow>(`SELECT ${CATALOG_COLUMNS} FROM catalog_projection WHERE medication_id = ANY($1::int[])`, [ids], 'loader'),
        (r) => r.medication_id,
      ),
    ),

    medicationsByCategory: make<number, CatalogRow[]>('medicationsByCategory', async (ids) =>
      groupByKeys(
        ids,
        await db.query<CatalogRow>(
          `SELECT ${CATALOG_COLUMNS} FROM catalog_projection WHERE category_id = ANY($1::int[]) ORDER BY commercial_name`,
          [ids],
          'loader',
        ),
        (r) => r.category_id,
      ),
    ),

    medicationsByLaboratory: make<number, CatalogRow[]>('medicationsByLaboratory', async (ids) =>
      groupByKeys(
        ids,
        await db.query<CatalogRow>(
          `SELECT ${CATALOG_COLUMNS} FROM catalog_projection WHERE laboratory_id = ANY($1::int[]) ORDER BY commercial_name`,
          [ids],
          'loader',
        ),
        (r) => r.laboratory_id,
      ),
    ),

    medicationsByActiveIngredient: make<number, CatalogRow[]>('medicationsByActiveIngredient', async (ids) =>
      groupByKeys(
        ids,
        await db.query<CatalogRow>(
          `SELECT ${CATALOG_COLUMNS} FROM catalog_projection WHERE active_ingredient_id = ANY($1::int[]) ORDER BY commercial_name`,
          [ids],
          'loader',
        ),
        (r) => r.active_ingredient_id,
      ),
    ),

    medicationCountByCategory: make<number, number>('medicationCountByCategory', async (ids) => {
      const rows = await db.query<{ category_id: number; count: number }>(
        `SELECT category_id, count(*) AS count FROM catalog_projection WHERE category_id = ANY($1::int[]) GROUP BY category_id`,
        [ids],
        'loader',
      );
      const counts = new Map(rows.map((row) => [row.category_id, row.count]));
      return ids.map((id) => counts.get(id) ?? 0);
    }),

    user: make<string, UserRow | null>('user', async (ids) =>
      orderByKeys(
        ids,
        await db.query<UserRow>(`SELECT id, email, full_name, role FROM users WHERE id = ANY($1::uuid[])`, [ids], 'loader'),
        (r) => r.id,
      ),
    ),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;
