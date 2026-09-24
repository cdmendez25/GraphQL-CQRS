import { graphql } from 'graphql';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { schema } from '../src/schema/index.js';
import { createLoaders } from '../src/read/loaders/index.js';
import type { Db } from '../src/shared/db.js';
import type { GraphQLContext } from '../src/shared/context.js';

/** 12 medicamentos repartidos entre 4 laboratorios y 3 categorías. */
const catalog = Array.from({ length: 12 }, (_, i) => ({
  medication_id: i + 1,
  sku: `MED-${String(i + 1).padStart(3, '0')}`,
  commercial_name: `Medicamento ${i + 1}`,
  active_ingredient_id: i + 1,
  active_ingredient: `Principio ${i + 1}`,
  category_id: (i % 3) + 1,
  category: `Categoría ${(i % 3) + 1}`,
  category_slug: `categoria-${(i % 3) + 1}`,
  laboratory_id: (i % 4) + 1,
  laboratory: `Lab ${(i % 4) + 1}`,
  dosage: '500 mg',
  presentation: 'Caja x 10',
  price: '1000.00',
  requires_prescription: false,
  description: '…',
  stock_available: 10,
  updated_at: new Date(),
}));

/** Db falsa que registra cada SQL y responde según la tabla consultada. */
function fakeDb() {
  const sql: string[] = [];
  const db: Db = {
    stats: { requestId: 'test', count: 0 },
    async query(text: string, params: unknown[] = []) {
      sql.push(text);
      db.stats.count += 1;
      if (/FROM catalog_projection/.test(text) && /LIMIT/.test(text)) return catalog as any;
      if (/FROM laboratories WHERE id = ANY/.test(text)) {
        return (params[0] as number[]).map((id) => ({ id, name: `Lab ${id}` })) as any;
      }
      if (/FROM therapeutic_categories WHERE id = ANY/.test(text)) {
        return (params[0] as number[]).map((id) => ({ id, name: `Categoría ${id}`, slug: `categoria-${id}` })) as any;
      }
      return [];
    },
  };
  return { db, sql };
}

const QUERY = /* GraphQL */ `
  query Catalogo {
    medications(first: 12) {
      edges { node { id name laboratory { name } category { name } } }
    }
  }
`;

async function run(batching: boolean) {
  const { db, sql } = fakeDb();
  const contextValue: GraphQLContext = { user: null, db, stats: db.stats, loaders: createLoaders(db, { batching, caching: batching }) };
  const result = await graphql({ schema, source: QUERY, contextValue });
  expect(result.errors).toBeUndefined();
  return { result, sql };
}

describe('Mitigación del problema N+1 con DataLoader', () => {
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('con DataLoader: 1 consulta de catálogo + 1 de laboratorios + 1 de categorías', async () => {
    const { result, sql } = await run(true);
    const labQueries = sql.filter((q) => q.includes('FROM laboratories'));
    expect(labQueries).toHaveLength(1);
    expect(sql.filter((q) => q.includes('FROM therapeutic_categories'))).toHaveLength(1);
    expect(sql).toHaveLength(3);
    const edges = (result.data as any).medications.edges;
    expect(edges).toHaveLength(12);
    expect(edges[5].node.laboratory.name).toBe('Lab 2');
  });

  it('sin DataLoader: 1 + 12 + 12 consultas (el problema N+1)', async () => {
    const { sql } = await run(false);
    expect(sql.filter((q) => q.includes('FROM laboratories'))).toHaveLength(12);
    expect(sql).toHaveLength(25);
  });

  it('solo selecciona lo pedido: la vista condensada no toca tablas relacionadas', async () => {
    const { db, sql } = fakeDb();
    const contextValue: GraphQLContext = { user: null, db, stats: db.stats, loaders: createLoaders(db, { batching: true, caching: true }) };
    const result = await graphql({
      schema,
      source: `{ medications(first: 12) { edges { node { name price presentation } } } }`,
      contextValue,
    });
    expect(result.errors).toBeUndefined();
    expect(sql).toHaveLength(1);
    expect(Object.keys((result.data as any).medications.edges[0].node)).toEqual(['name', 'price', 'presentation']);
  });
});
