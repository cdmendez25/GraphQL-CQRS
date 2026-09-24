import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DomainErrors, RequestError } from '../components/DomainErrors';
import { formatDateTime, formatMoney } from '../components/format';
import { OrderStatusBadge, PrescriptionBadge, RxTag } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import type { DomainErrorFieldsFragment, OrderDetailFieldsFragment } from '../gql/graphql';
import {
  APPROVE_ORDER_MUTATION,
  DISPATCH_ORDER_MUTATION,
  ORDER_STATUS_SUBSCRIPTION,
  PHARMACY_QUEUE_QUERY,
  REJECT_ORDER_MUTATION,
} from '../graphql/operations';

const ACTIVE = new Set(['PENDING_APPROVAL', 'APPROVED']);

interface TransitionPayload {
  aggregateVersion?: number | null;
  errors: DomainErrorFieldsFragment[];
}

function QueueCard({ order }: { order: OrderDetailFieldsFragment }) {
  const toast = useToast();
  const [awaitingVersion, setAwaitingVersion] = useState<number | null>(null);
  const [errors, setErrors] = useState<DomainErrorFieldsFragment[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [approve, approveState] = useMutation(APPROVE_ORDER_MUTATION);
  const [reject, rejectState] = useMutation(REJECT_ORDER_MUTATION);
  const [dispatch, dispatchState] = useMutation(DISPATCH_ORDER_MUTATION);
  const busy = approveState.loading || rejectState.loading || dispatchState.loading;
  const syncing = awaitingVersion !== null && order.projectionVersion < awaitingVersion;

  /** El comando responde con la nueva versión del agregado; la proyección la alcanzará vía subscription. */
  const handle = (payload: TransitionPayload | undefined, message: string) => {
    if (!payload) return;
    setErrors(payload.errors);
    if (payload.errors.length === 0 && payload.aggregateVersion) {
      setAwaitingVersion(payload.aggregateVersion);
      toast(message, 'success');
    }
  };

  return (
    <article className="card queue-card">
      <header className="queue-head">
        <div>
          <Link to={`/orders/${order.id}`}>
            <strong>#{order.id.slice(0, 8)}</strong>
          </Link>{' '}
          · {order.patient.fullName}
          <div className="muted small">{formatDateTime(order.placedAt)}</div>
        </div>
        <div className="queue-status">
          <OrderStatusBadge status={order.status} />
          <small className="muted">v{order.projectionVersion}</small>
        </div>
      </header>

      <ul className="queue-items">
        {order.items.map((item) => (
          <li key={item.medication.id}>
            {item.quantity} × {item.medicationName} {item.requiresPrescription && <RxTag />}
          </li>
        ))}
      </ul>
      <p className="price">{formatMoney(order.total)}</p>

      {order.prescription && (
        <div className="rx-box">
          <PrescriptionBadge status={order.prescription.status} />
          <div className="small">
            {order.prescription.doctorName} · RM {order.prescription.doctorLicense} · {order.prescription.prescriptionCode} · emitida{' '}
            {order.prescription.issuedAt}
          </div>
          {order.prescription.notes && <div className="muted small">{order.prescription.notes}</div>}
        </div>
      )}

      {syncing && (
        <p className="sync small">
          <span className="spinner" /> Comando aceptado (v{awaitingVersion}). Esperando proyección…
        </p>
      )}
      <DomainErrors errors={errors} />

      {rejecting ? (
        <div className="stack">
          <textarea
            className="input"
            placeholder="Motivo del rechazo (visible para el paciente)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="actions">
            <button
              className="btn btn-danger btn-sm"
              disabled={busy}
              onClick={async () => {
                const { data } = await reject({ variables: { input: { orderId: order.id, reason } } });
                handle(data?.rejectOrder, 'Pedido rechazado; stock liberado.');
                if (data?.rejectOrder.errors.length === 0) setRejecting(false);
              }}
            >
              Confirmar rechazo
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRejecting(false)}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          {order.status === 'PENDING_APPROVAL' && (
            <>
              <button
                className="btn btn-primary btn-sm"
                disabled={busy || syncing}
                onClick={async () => {
                  const { data } = await approve({ variables: { input: { orderId: order.id, notes: 'Fórmula revisada por Q.F.' } } });
                  handle(data?.approveOrder, 'Pedido aprobado.');
                }}
              >
                Aprobar
              </button>
              <button className="btn btn-secondary btn-sm" disabled={busy || syncing} onClick={() => setRejecting(true)}>
                Rechazar
              </button>
            </>
          )}
          {order.status === 'APPROVED' && (
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || syncing}
              onClick={async () => {
                const { data } = await dispatch({ variables: { input: { orderId: order.id } } });
                handle(data?.dispatchOrder, 'Pedido despachado.');
              }}
            >
              Despachar
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** Cola del químico farmacéutico, actualizada en tiempo real por subscription. */
export function PharmacyPage() {
  const { data, loading, error, subscribeToMore } = useQuery(PHARMACY_QUEUE_QUERY);

  useEffect(
    () =>
      subscribeToMore({
        document: ORDER_STATUS_SUBSCRIPTION,
        variables: {},
        updateQuery: (previous, { subscriptionData }) => {
          const order = subscriptionData.data?.orderStatusChanged;
          if (!order) return previous as never;
          const queue = (previous.pharmacyQueue ?? []).filter((existing) => existing && existing.id !== order.id);
          // Entra/permanece si está activo; sale si fue despachado o cancelado.
          const next = ACTIVE.has(order.status) ? [...queue, order] : queue;
          next.sort((a, b) => ((a?.placedAt ?? '') < (b?.placedAt ?? '') ? -1 : 1));
          return { ...previous, pharmacyQueue: next } as never;
        },
      }),
    [subscribeToMore],
  );

  if (error) return <RequestError error={error} />;
  const queue = data?.pharmacyQueue ?? [];
  const pending = queue.filter((order) => order.status === 'PENDING_APPROVAL');
  const approved = queue.filter((order) => order.status === 'APPROVED');

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Panel de farmacia</h1>
          <p className="muted">Los pedidos nuevos y los cambios de estado llegan en tiempo real.</p>
        </div>
      </div>
      {loading && queue.length === 0 && <div className="card skeleton detail-skeleton" />}
      <div className="columns">
        <div>
          <h2 className="section-title">
            Por aprobar <span className="pill">{pending.length}</span>
          </h2>
          {pending.length === 0 && <div className="empty card small">Sin pedidos pendientes.</div>}
          {pending.map((order) => (
            <QueueCard key={order.id} order={order} />
          ))}
        </div>
        <div>
          <h2 className="section-title">
            Por despachar <span className="pill">{approved.length}</span>
          </h2>
          {approved.length === 0 && <div className="empty card small">Sin pedidos aprobados.</div>}
          {approved.map((order) => (
            <QueueCard key={order.id} order={order} />
          ))}
        </div>
      </div>
    </section>
  );
}
