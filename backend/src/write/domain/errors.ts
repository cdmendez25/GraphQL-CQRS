import type { OrderStatus } from './order.js';

/**
 * Errores de negocio esperados. Viajan dentro de los payloads de las
 * mutations (`errors: [DomainError!]!`) en lugar de romper la respuesta.
 */
export type DomainError =
  | { kind: 'OutOfStockError'; code: 'OUT_OF_STOCK'; message: string; medicationId: number; requested: number; available: number }
  | { kind: 'PrescriptionRequiredError'; code: 'PRESCRIPTION_REQUIRED'; message: string; medicationIds: number[] }
  | { kind: 'InvalidStateTransitionError'; code: 'INVALID_STATE_TRANSITION'; message: string; from: OrderStatus; to: OrderStatus }
  | { kind: 'ValidationError'; code: 'VALIDATION' | 'EMPTY_CART'; message: string; field: string }
  | { kind: 'NotFoundError'; code: 'NOT_FOUND'; message: string; entity: string; id: string }
  | { kind: 'UnauthorizedError'; code: 'UNAUTHORIZED' | 'INVALID_CREDENTIALS'; message: string };

export const DomainErrors = {
  outOfStock: (medicationId: number, name: string, requested: number, available: number): DomainError => ({
    kind: 'OutOfStockError',
    code: 'OUT_OF_STOCK',
    message: `Stock insuficiente de ${name}: pediste ${requested}, hay ${available} disponibles.`,
    medicationId,
    requested,
    available,
  }),
  prescriptionRequired: (medicationIds: number[], names: string[]): DomainError => ({
    kind: 'PrescriptionRequiredError',
    code: 'PRESCRIPTION_REQUIRED',
    message: `Se requiere fórmula médica para: ${names.join(', ')}.`,
    medicationIds,
  }),
  invalidTransition: (from: OrderStatus, to: OrderStatus): DomainError => ({
    kind: 'InvalidStateTransitionError',
    code: 'INVALID_STATE_TRANSITION',
    message: `Un pedido en estado ${from} no puede pasar a ${to}.`,
    from,
    to,
  }),
  validation: (field: string, message: string): DomainError => ({ kind: 'ValidationError', code: 'VALIDATION', field, message }),
  emptyCart: (): DomainError => ({
    kind: 'ValidationError',
    code: 'EMPTY_CART',
    field: 'cart',
    message: 'El carrito está vacío.',
  }),
  notFound: (entity: string, id: string | number): DomainError => ({
    kind: 'NotFoundError',
    code: 'NOT_FOUND',
    message: `${entity} ${id} no existe.`,
    entity,
    id: String(id),
  }),
  unauthorized: (message = 'No tienes permiso para ejecutar esta acción.'): DomainError => ({
    kind: 'UnauthorizedError',
    code: 'UNAUTHORIZED',
    message,
  }),
  invalidCredentials: (): DomainError => ({
    kind: 'UnauthorizedError',
    code: 'INVALID_CREDENTIALS',
    message: 'Correo o contraseña incorrectos.',
  }),
};

/**
 * Se lanza dentro de un command handler para abortar la transacción
 * (ROLLBACK) y devolver los errores de dominio al cliente.
 */
export class DomainFailure extends Error {
  constructor(readonly errors: DomainError[]) {
    super(errors.map((error) => error.message).join(' | '));
  }
}

export function fail(...errors: DomainError[]): never {
  throw new DomainFailure(errors);
}
