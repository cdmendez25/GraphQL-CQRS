import type { OrderStatus } from '../gql/graphql';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING_APPROVAL', label: 'Recibido' },
  { status: 'APPROVED', label: 'Aprobado' },
  { status: 'DISPATCHED', label: 'Despachado' },
];

/** Línea de tiempo de la máquina de estados del pedido. */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    return (
      <ol className="timeline">
        <li className="step step-done">Recibido</li>
        <li className="step step-cancelled">Cancelado</li>
      </ol>
    );
  }
  const current = STEPS.findIndex((step) => step.status === status);
  return (
    <ol className="timeline">
      {STEPS.map((step, index) => (
        <li key={step.status} className={`step ${index < current ? 'step-done' : index === current ? 'step-current' : ''}`}>
          {step.label}
        </li>
      ))}
    </ol>
  );
}
