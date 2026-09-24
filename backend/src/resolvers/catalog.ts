import type { GraphQLContext } from '../shared/context.js';
import {
  countMedications,
  decodeCursor,
  encodeCursor,
  listCategories,
  listLaboratories,
  searchMedications,
  type CatalogRow,
  type MedicationFilter,
  type MedicationSort,
} from '../read/repositories/catalogReadRepo.js';
import type { CategoryRow, ReferenceRow } from '../read/loaders/index.js';
import { badInput, toIntId } from './helpers.js';

interface MedicationsArgs {
  filter?: (Omit<MedicationFilter, 'categoryIds' | 'laboratoryIds'> & { categoryIds?: string[]; laboratoryIds?: string[] }) | null;
  sort?: MedicationSort | null;
  first?: number | null;
  after?: string | null;
}

const LOW_STOCK_THRESHOLD = 10;

/**
 * Resolvers de LECTURA del catálogo. Solo consultan el read model
 * (catalog_projection) y los datos maestros; jamás invocan comandos.
 */
export const catalogResolvers = {
  Query: {
    async medications(_: unknown, args: MedicationsArgs, ctx: GraphQLContext) {
      const first = args.first ?? 12;
      if (first < 1 || first > 50) throw badInput('first debe estar entre 1 y 50.');
      const after = args.after ? decodeCursor(args.after) : null;
      if (args.after && !after) throw badInput('Cursor inválido.');

      const sort: MedicationSort = args.sort ?? { field: 'NAME', direction: 'ASC' };
      const filter: MedicationFilter | null = args.filter
        ? {
            ...args.filter,
            categoryIds: args.filter.categoryIds?.map((id) => toIntId(id, 'categoryIds')),
            laboratoryIds: args.filter.laboratoryIds?.map((id) => toIntId(id, 'laboratoryIds')),
          }
        : null;

      const { rows, hasNextPage } = await searchMedications(ctx.db, { filter, sort, first, after });
      // Las filas ya leídas alimentan la caché del loader (ej. para OrderLine.medication).
      rows.forEach((row) => ctx.loaders.medication.prime(row.medication_id, row));
      const edges = rows.map((row) => ({ cursor: encodeCursor(row, sort), node: row }));
      return {
        edges,
        pageInfo: { hasNextPage, endCursor: edges.at(-1)?.cursor ?? null },
        filter, // lo usa totalCount solo si el cliente lo pide
      };
    },

    medication: (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => ctx.loaders.medication.load(toIntId(id)),

    therapeuticCategories: (_: unknown, __: unknown, ctx: GraphQLContext) => listCategories(ctx.db),

    laboratories: (_: unknown, __: unknown, ctx: GraphQLContext) => listLaboratories(ctx.db),
  },

  MedicationConnection: {
    /** El COUNT(*) solo se ejecuta si la operación selecciona este campo. */
    totalCount: (connection: { filter: MedicationFilter | null }, _: unknown, ctx: GraphQLContext) =>
      countMedications(ctx.db, connection.filter),
  },

  Medication: {
    id: (row: CatalogRow) => row.medication_id,
    name: (row: CatalogRow) => row.commercial_name,
    requiresPrescription: (row: CatalogRow) => row.requires_prescription,
    indications: (row: CatalogRow) => row.description,
    stockAvailable: (row: CatalogRow) => row.stock_available,
    stockStatus: (row: CatalogRow) =>
      row.stock_available === 0 ? 'OUT_OF_STOCK' : row.stock_available < LOW_STOCK_THRESHOLD ? 'LOW_STOCK' : 'IN_STOCK',
    updatedAt: (row: CatalogRow) => row.updated_at,
    // Relaciones anidadas → DataLoader (una consulta por tipo de entidad, no una por medicamento).
    activeIngredient: (row: CatalogRow, _: unknown, ctx: GraphQLContext) => ctx.loaders.activeIngredient.load(row.active_ingredient_id),
    category: (row: CatalogRow, _: unknown, ctx: GraphQLContext) => ctx.loaders.category.load(row.category_id),
    laboratory: (row: CatalogRow, _: unknown, ctx: GraphQLContext) => ctx.loaders.laboratory.load(row.laboratory_id),
  },

  Laboratory: {
    medications: (lab: ReferenceRow, _: unknown, ctx: GraphQLContext) => ctx.loaders.medicationsByLaboratory.load(lab.id),
  },

  TherapeuticCategory: {
    medicationCount: (category: CategoryRow, _: unknown, ctx: GraphQLContext) => ctx.loaders.medicationCountByCategory.load(category.id),
    medications: (category: CategoryRow, _: unknown, ctx: GraphQLContext) => ctx.loaders.medicationsByCategory.load(category.id),
  },

  ActiveIngredient: {
    medications: (ingredient: ReferenceRow, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.medicationsByActiveIngredient.load(ingredient.id),
  },
};
