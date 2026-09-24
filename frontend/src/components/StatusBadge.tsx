import type { OrderStatus, PrescriptionStatus, StockStatus } from '../gql/graphql';

const ORDER_LABELS: Record<OrderStatus, string> = {
  PENDING_APPROVAL: 'Pendiente de aprobación',
  APPROVED: 'Aprobado',
  DISPATCHED: 'Despachado',
  CANCELLED: 'Cancelado',
};

const PRESCRIPTION_LABELS: Record<PrescriptionStatus, string> = {
  PENDING_REVIEW: 'Fórmula en verificación',
  AUTO_VERIFIED: 'Registro médico verificado',
  APPROVED: 'Fórmula aprobada',
  REJECTED: 'Fórmula rechazada',
};

const STOCK_LABELS: Record<StockStatus, string> = {
  IN_STOCK: 'Disponible',
  LOW_STOCK: 'Pocas unidades',
  OUT_OF_STOCK: 'Agotado',
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <span className={`badge badge-${status.toLowerCase()}`}>{ORDER_LABELS[status]}</span>
);

export const PrescriptionBadge = ({ status }: { status: PrescriptionStatus }) => (
  <span className={`badge badge-rx-${status.toLowerCase()}`}>{PRESCRIPTION_LABELS[status]}</span>
);

export const StockBadge = ({ status }: { status: StockStatus }) => (
  <span className={`badge badge-stock-${status.toLowerCase()}`}>{STOCK_LABELS[status]}</span>
);

export const RxTag = () => (
  <span className="badge badge-rx" title="Requiere fórmula médica">
    ℞ Fórmula médica
  </span>
);
