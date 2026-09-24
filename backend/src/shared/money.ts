/**
 * El dinero se maneja en centavos enteros para evitar errores de punto flotante
 * y se serializa como string decimal ("9500.00") igual que numeric de PostgreSQL.
 */
export const toCents = (value: string | number): number => Math.round(Number(value) * 100);

export const fromCents = (cents: number): string => (cents / 100).toFixed(2);

export const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
