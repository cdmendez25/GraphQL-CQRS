import { DomainErrors, type DomainError } from './errors.js';
import { fromCents, toCents } from '../../shared/money.js';

export type OrderStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'DISPATCHED' | 'CANCELLED';

/**
 * Máquina de estados del agregado Order.
 *   PENDING_APPROVAL ──► APPROVED ──► DISPATCHED
 *          │                 │
 *          └──────► CANCELLED ◄┘
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: [],
  CANCELLED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);

export function checkTransition(from: OrderStatus, to: OrderStatus): DomainError | null {
  return canTransition(from, to) ? null : DomainErrors.invalidTransition(from, to);
}

export interface OrderLineDraft {
  medicationId: number;
  name: string;
  presentation: string;
  quantity: number;
  unitPrice: string;
  requiresPrescription: boolean;
}

/** Total del pedido calculado en centavos (sin errores de punto flotante). */
export const orderTotal = (lines: readonly Pick<OrderLineDraft, 'quantity' | 'unitPrice'>[]): string =>
  fromCents(lines.reduce((sum, line) => sum + toCents(line.unitPrice) * line.quantity, 0));

/** Invariante: medicamentos con fórmula obligatoria dentro del pedido. */
export const linesRequiringPrescription = (lines: readonly OrderLineDraft[]) =>
  lines.filter((line) => line.requiresPrescription);

/**
 * Invariante: no se vende lo que no hay. Devuelve un error por cada
 * medicamento cuyo stock bloqueado no cubre la cantidad solicitada.
 */
export function findStockShortages(lines: readonly OrderLineDraft[], available: ReadonlyMap<number, number>): DomainError[] {
  return lines.flatMap((line) => {
    const units = available.get(line.medicationId) ?? 0;
    return units < line.quantity ? [DomainErrors.outOfStock(line.medicationId, line.name, line.quantity, units)] : [];
  });
}
