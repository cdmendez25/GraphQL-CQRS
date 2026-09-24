import { GraphQLError, GraphQLScalarType, Kind, type ValueNode } from 'graphql';
import { MONEY_PATTERN, fromCents, toCents } from './money.js';

const invalid = (scalar: string, detail: string) =>
  new GraphQLError(`${scalar} inválido: ${detail}`, { extensions: { code: 'BAD_USER_INPUT' } });

const literalValue = (ast: ValueNode): unknown =>
  ast.kind === Kind.INT || ast.kind === Kind.FLOAT || ast.kind === Kind.STRING ? ast.value : undefined;

/** Valor monetario en pesos colombianos (COP). Se serializa como string decimal con 2 decimales. */
export const MoneyScalar = new GraphQLScalarType({
  name: 'Money',
  description: 'Valor monetario en COP serializado como string decimal (ej. "9500.00"). Nunca negativo.',
  serialize: (value) => fromCents(toCents(value as string | number)),
  parseValue: (value) => parseMoney(value),
  parseLiteral: (ast) => parseMoney(literalValue(ast)),
});

function parseMoney(value: unknown): string {
  const text = String(value ?? '');
  if (!MONEY_PATTERN.test(text)) throw invalid('Money', `"${text}" debe ser un decimal positivo con máximo 2 decimales`);
  return fromCents(toCents(text));
}

/** Entero estrictamente mayor que cero (cantidades de un pedido). */
export const PositiveIntScalar = new GraphQLScalarType({
  name: 'PositiveInt',
  description: 'Entero mayor que 0 (ej. cantidades de un ítem).',
  serialize: (value) => Number(value),
  parseValue: (value) => parsePositiveInt(value),
  parseLiteral: (ast) => parsePositiveInt(ast.kind === Kind.INT ? Number(ast.value) : undefined),
});

function parsePositiveInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 999) {
    throw invalid('PositiveInt', `${String(value)} debe ser un entero entre 1 y 999`);
  }
  return value;
}

/** Instante ISO-8601 con zona horaria. */
export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'Fecha y hora ISO-8601 en UTC (ej. "2026-09-24T15:04:05.000Z").',
  serialize: (value) => new Date(value as string | Date).toISOString(),
  parseValue: (value) => parseDateTime(value),
  parseLiteral: (ast) => parseDateTime(ast.kind === Kind.STRING ? ast.value : undefined),
});

function parseDateTime(value: unknown): Date {
  const date = new Date(String(value));
  if (typeof value !== 'string' || Number.isNaN(date.getTime())) throw invalid('DateTime', String(value));
  return date;
}

/** Fecha calendario sin hora (fecha de emisión de la fórmula médica). */
export const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Fecha calendario YYYY-MM-DD, sin hora ni zona horaria.',
  serialize: (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value)),
  parseValue: (value) => parseDate(value),
  parseLiteral: (ast) => parseDate(ast.kind === Kind.STRING ? ast.value : undefined),
});

function parseDate(value: unknown): string {
  const text = String(value ?? '');
  const date = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw invalid('Date', `"${text}" debe tener formato YYYY-MM-DD`);
  }
  return text;
}

/** Código interno de producto de Afirmative Pill. */
export const SKUScalar = new GraphQLScalarType({
  name: 'SKU',
  description: 'Código de producto con formato MED-000.',
  serialize: (value) => String(value),
  parseValue: (value) => parseSku(value),
  parseLiteral: (ast) => parseSku(ast.kind === Kind.STRING ? ast.value : undefined),
});

function parseSku(value: unknown): string {
  const text = String(value ?? '');
  if (!/^MED-\d{3}$/.test(text)) throw invalid('SKU', `"${text}" debe tener formato MED-000`);
  return text;
}

export const scalarResolvers = {
  Money: MoneyScalar,
  PositiveInt: PositiveIntScalar,
  DateTime: DateTimeScalar,
  Date: DateScalar,
  SKU: SKUScalar,
};
