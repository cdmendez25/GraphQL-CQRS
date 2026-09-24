/**
 * Carga el dataset oficial de 50 medicamentos (data/medicamentos.csv,
 * exportado del Excel del taller) en el write model, crea usuarios demo y
 * construye las proyecciones. Es idempotente: vacía las tablas antes de cargar.
 * Uso: npm run db:seed
 */
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { closePool, newStats, withTransaction } from '../src/shared/db.js';
import { slugify } from '../src/shared/text.js';
import { rebuildProjections } from '../src/projections/rebuild.js';
import { normalizeDosage } from './dataset.js';

process.env.LOG_SQL = 'false';

interface CsvRow {
  id: string;
  sku: string;
  name: string;
  active_ingredient: string;
  category: string;
  dosage: string;
  presentation: string;
  price: string;
  stock: string;
  requires_prescription: string;
  manufacturer: string;
  description: string;
}

const DEMO_USERS = [
  { email: 'paciente@afirmativepill.co', fullName: 'Laura Gómez', password: 'Paciente123!', role: 'PATIENT' },
  { email: 'paciente2@afirmativepill.co', fullName: 'Andrés Pérez', password: 'Paciente123!', role: 'PATIENT' },
  { email: 'farmaceutico@afirmativepill.co', fullName: 'Q.F. Marta Ruiz', password: 'Farmacia123!', role: 'PHARMACIST' },
];

const csv = readFileSync(new URL('../../data/medicamentos.csv', import.meta.url), 'utf8');
const rows: CsvRow[] = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
if (rows.length !== 50) throw new Error(`Se esperaban 50 medicamentos y el CSV tiene ${rows.length}`);

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es'));
const stats = newStats('seed');

await withTransaction(stats, async (db) => {
  await db.query(`TRUNCATE order_summary_projection, catalog_projection, projection_checkpoints, domain_events,
                  prescriptions, order_items, orders, cart_items, carts, users, inventory, medications,
                  active_ingredients, therapeutic_categories, laboratories RESTART IDENTITY CASCADE`);

  const insertNames = async (table: string, names: string[], withSlug = false) => {
    const inserted = await db.query<{ id: number; name: string }>(
      withSlug
        ? `INSERT INTO ${table} (name, slug) SELECT * FROM unnest($1::text[], $2::text[]) RETURNING id, name`
        : `INSERT INTO ${table} (name) SELECT * FROM unnest($1::text[]) RETURNING id, name`,
      withSlug ? [names, names.map(slugify)] : [names],
    );
    return new Map(inserted.map((row) => [row.name, row.id]));
  };

  const labs = await insertNames('laboratories', unique(rows.map((r) => r.manufacturer)));
  const categories = await insertNames('therapeutic_categories', unique(rows.map((r) => r.category)), true);
  const ingredients = await insertNames('active_ingredients', unique(rows.map((r) => r.active_ingredient)));

  await db.query(
    `INSERT INTO medications (id, sku, commercial_name, active_ingredient_id, category_id, laboratory_id,
                              dosage, presentation, price, requires_prescription, description)
     SELECT * FROM unnest($1::int[], $2::text[], $3::text[], $4::int[], $5::int[], $6::int[],
                          $7::text[], $8::text[], $9::numeric[], $10::boolean[], $11::text[])`,
    [
      rows.map((r) => Number(r.id)),
      rows.map((r) => r.sku),
      rows.map((r) => r.name),
      rows.map((r) => ingredients.get(r.active_ingredient)),
      rows.map((r) => categories.get(r.category)),
      rows.map((r) => labs.get(r.manufacturer)),
      rows.map((r) => normalizeDosage(r.dosage)),
      rows.map((r) => r.presentation),
      rows.map((r) => r.price),
      rows.map((r) => r.requires_prescription === '1'),
      rows.map((r) => r.description),
    ],
  );
  await db.query(
    `INSERT INTO inventory (medication_id, available) SELECT * FROM unnest($1::int[], $2::int[])`,
    [rows.map((r) => Number(r.id)), rows.map((r) => Number(r.stock))],
  );

  for (const user of DEMO_USERS) {
    await db.query(`INSERT INTO users (email, full_name, password_hash, role) VALUES ($1, $2, $3, $4)`, [
      user.email,
      user.fullName,
      await bcrypt.hash(user.password, 10),
      user.role,
    ]);
  }
  console.log(
    `[seed] ✔ ${rows.length} medicamentos · ${labs.size} laboratorios · ${categories.size} categorías · ` +
      `${ingredients.size} principios activos · ${DEMO_USERS.length} usuarios demo`,
  );
});

const result = await rebuildProjections(stats);
console.log(`[seed] ✔ proyecciones construidas: ${result.medications} medicamentos en catalog_projection`);
console.log('[seed] usuarios demo:');
for (const user of DEMO_USERS) console.log(`        ${user.role.padEnd(10)} ${user.email} / ${user.password}`);
await closePool();
