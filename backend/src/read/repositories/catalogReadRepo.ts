import type { Db } from '../../shared/db.js';
import { normalizeText } from '../../shared/text.js';

/** Fila de catalog_projection (read model desnormalizado). */
export interface CatalogRow {
  medication_id: number;
  sku: string;
  commercial_name: string;
  active_ingredient_id: number;
  active_ingredient: string;
  category_id: number;
  category: string;
  category_slug: string;
  laboratory_id: number;
  laboratory: string;
  dosage: string;
  presentation: string;
  price: string;
  requires_prescription: boolean;
  description: string;
  stock_available: number;
  updated_at: Date;
}

export const CATALOG_COLUMNS = `medication_id, sku, commercial_name, active_ingredient_id, active_ingredient,
  category_id, category, category_slug, laboratory_id, laboratory, dosage, presentation, price,
  requires_prescription, description, stock_available, updated_at`;

export interface MedicationFilter {
  search?: string | null;
  categoryIds?: number[] | null;
  laboratoryIds?: number[] | null;
  requiresPrescription?: boolean | null;
  inStockOnly?: boolean | null;
  minPrice?: string | null;
  maxPrice?: string | null;
}

export interface MedicationSort {
  field: 'NAME' | 'PRICE';
  direction: 'ASC' | 'DESC';
}

const SORT_COLUMN = { NAME: 'commercial_name', PRICE: 'price' } as const;

function whereClauses(filter: MedicationFilter | null | undefined, params: unknown[]): string[] {
  const clauses: string[] = [];
  const add = (sql: (placeholder: string) => string, value: unknown) => {
    params.push(value);
    clauses.push(sql(`$${params.length}`));
  };
  if (!filter) return clauses;

  const search = filter.search ? normalizeText(filter.search) : '';
  if (search) add((p) => `search_text LIKE ${p}`, `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (filter.categoryIds?.length) add((p) => `category_id = ANY(${p}::int[])`, filter.categoryIds);
  if (filter.laboratoryIds?.length) add((p) => `laboratory_id = ANY(${p}::int[])`, filter.laboratoryIds);
  if (filter.requiresPrescription != null) add((p) => `requires_prescription = ${p}`, filter.requiresPrescription);
  if (filter.inStockOnly) clauses.push('stock_available > 0');
  if (filter.minPrice != null) add((p) => `price >= ${p}::numeric`, filter.minPrice);
  if (filter.maxPrice != null) add((p) => `price <= ${p}::numeric`, filter.maxPrice);
  return clauses;
}

// Cursor opaco = base64url([valorDeOrden, id]) → paginación keyset estable.
export const encodeCursor = (row: CatalogRow, sort: MedicationSort) =>
  Buffer.from(JSON.stringify([sort.field === 'PRICE' ? row.price : row.commercial_name, row.medication_id])).toString('base64url');

export function decodeCursor(cursor: string): [string, number] | null {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return Array.isArray(value) && value.length === 2 && typeof value[1] === 'number' ? [String(value[0]), value[1]] : null;
  } catch {
    return null;
  }
}

export async function searchMedications(
  db: Db,
  args: { filter?: MedicationFilter | null; sort: MedicationSort; first: number; after?: [string, number] | null },
): Promise<{ rows: CatalogRow[]; hasNextPage: boolean }> {
  const params: unknown[] = [];
  const clauses = whereClauses(args.filter, params);
  const column = SORT_COLUMN[args.sort.field];
  const direction = args.sort.direction;

  if (args.after) {
    params.push(args.after[0], args.after[1]);
    const cast = args.sort.field === 'PRICE' ? '::numeric' : '';
    const op = direction === 'ASC' ? '>' : '<';
    clauses.push(`(${column}, medication_id) ${op} ($${params.length - 1}${cast}, $${params.length})`);
  }

  params.push(args.first + 1);
  const rows = await db.query<CatalogRow>(
    `SELECT ${CATALOG_COLUMNS} FROM catalog_projection
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY ${column} ${direction}, medication_id ${direction}
      LIMIT $${params.length}`,
    params,
    'catálogo',
  );
  return { rows: rows.slice(0, args.first), hasNextPage: rows.length > args.first };
}

export async function countMedications(db: Db, filter?: MedicationFilter | null): Promise<number> {
  const params: unknown[] = [];
  const clauses = whereClauses(filter, params);
  const [row] = await db.query<{ count: number }>(
    `SELECT count(*) AS count FROM catalog_projection ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}`,
    params,
    'totalCount',
  );
  return row.count;
}

export const listCategories = (db: Db) =>
  db.query<{ id: number; name: string; slug: string }>(`SELECT id, name, slug FROM therapeutic_categories ORDER BY name`);

export const listLaboratories = (db: Db) =>
  db.query<{ id: number; name: string }>(`SELECT id, name FROM laboratories ORDER BY name`);
