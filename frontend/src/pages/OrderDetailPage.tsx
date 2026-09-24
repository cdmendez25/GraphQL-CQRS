import { useMutation, useQuery, useSubscription } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DomainErrors, RequestError } from '../components/DomainErrors';
import { formatDateTime, formatMoney, formatTime } from '../components/format';
import { OrderTimeline } from '../components/OrderTimeline';
import { OrderStatusBadge, PrescriptionBadge, RxTag } from '../components/StatusBadge';
import type { CheckoutCartMutation, DomainErrorFieldsFragment, OrderDetailFieldsFragment } from '../gql/graphql';
import { CANCEL_ORDER_MUTATION, ORDER_QUERY, ORDER_STATUS_SUBSCRIPTION } from '../graphql/operations';

type Receipt = NonNullable<CheckoutCartMutation['checkoutCart']['receipt']>;

/** Qué está pasando "detrás" en cada estado, para que el paciente entienda la espera. */
function nextStepHint(order: OrderDetailFieldsFragment): string | null {
  if (order.status === 'PENDING_APPROVAL') {
    if (!order.requiresPrescription) return 'Pedido de venta libre: el sistema lo aprobará automáticamente en unos segundos.';
    if (order.prescription?.status === 'PENDING_REVIEW') return 'Estamos verificando el registro médico del prescriptor…';
    return 'Registro médico verificado. Un químico farmacéutico revisará tu fórmula.';
  }
  if (order.status === 'APPROVED') return 'Tu pedido está aprobado y en preparación para despacho.';
  if (order.status === 'DISPATCHED') return 'Tu pedido va en camino.';
  return null;
}

/**
 * Escenario C · seguimiento con consistencia eventual.
 *
 * 1. Justo después del checkout la proyección aún no existe (order = null):
 *    mostramos el ACUSE del comando (receipt) y consultamos cada segundo.
 * 2. La subscription orderStatusChanged empuja cada nueva versión de la
 *    proyección y la escribimos en la caché de la query → la UI se actualiza sola.
 * 3. Tras un comando (cancelar) comparamos la versión del agregado devuelta
 *    por el write model con projectionVersion para mostrar "sincronizando".
 */
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const receipt = (useLocation().state as { receipt?: Receipt } | null)?.receipt;
  const [live, setLive] = useState<string | null>(null);
  const [awaitingVersion, setAwaitingVersion] = useState<number | null>(null);
  const [commandErrors, setCommandErrors] = useState<DomainErrorFieldsFragment[]>([]);

  const { data, loading, error, startPolling, stopPolling } = useQuery(ORDER_QUERY, { variables: { id } });
  const order = data?.order ?? null;

  // Respaldo por polling SOLO mientras la proyección no existe.
  useEffect(() => {
    if (order) stopPolling();
    else startPolling(1000);
    return () => stopPolling();
  }, [order, startPolling, stopPolling]);

  useSubscription(ORDER_STATUS_SUBSCRIPTION, {
    variables: { orderId: id },
    onData: ({ client, data: event }) => {
      const updated = event.data?.orderStatusChanged;
      if (!updated) return;
      client.cache.writeQuery({ query: ORDER_QUERY, variables: { id }, data: { __typename: 'Query', order: updated } });
      setLive(new Date().toISOString());
    },
  });

  const [cancelOrder, { loading: cancelling }] = useMutation(CANCEL_ORDER_MUTATION);

  const cancel = async () => {
    if (!window.confirm('¿Cancelar este pedido? El stock reservado se liberará.')) return;
    setCommandErrors([]);
    const { data: result } = await cancelOrder({ variables: { input: { orderId: id, reason: 'Cancelado por el paciente desde la app.' } } });
    const payload = result?.cancelOrder;
    if (payload?.errors.length) setCommandErrors(payload.errors);
    else if (payload?.aggregateVersion) setAwaitingVersion(payload.aggregateVersion);
  };

  if (error) return <RequestError error={error} />;

  if (!order) {
    return (
      <section>
        <div className="card consistency">
          {receipt ? (
            <>
              <h1>✔ Pedido recibido</h1>
              <p>
                El comando <code>checkoutCart</code> se confirmó a las <strong>{formatTime(receipt.acceptedAt)}</strong>: el stock quedó
                reservado y tu pedido por <strong>{formatMoney(receipt.total)}</strong> ({receipt.itemCount} unidades) está registrado.
              </p>
            </>
          ) : (
            <h1>Buscando tu pedido…</h1>
          )}
          <p className="sync">
            <span className="spinner" /> Sincronizando la vista del pedido (read model). Esto toma solo unos segundos.
          </p>
          <p className="muted small">
            Consistencia eventual: el modelo de escritura ya tiene el pedido y el proyector está construyendo la versión optimizada para
            lectura. Esta pantalla se actualizará sola.
          </p>
        </div>
      </section>
    );
  }

  const syncing = awaitingVersion !== null && order.projectionVersion < awaitingVersion;
  const hint = nextStepHint(order);
  const canCancel = user?.role === 'PATIENT' && (order.status === 'PENDING_APPROVAL' || order.status === 'APPROVED');

  return (
    <section>
      {user?.role === 'PATIENT' ? (
        <Link to="/orders" className="back">
          ← Mis pedidos
        </Link>
      ) : (
        <Link to="/farmacia" className="back">
          ← Panel de farmacia
        </Link>
      )}
      <div className="card order-head">
        <div>
          <p className="muted small">Pedido #{order.id.slice(0, 8)}</p>
          <h1>
            <OrderStatusBadge status={order.status} /> {formatMoney(order.total)}
          </h1>
          <p className="muted">
            {order.itemCount} unidad(es) · realizado el {formatDateTime(order.placedAt)}
          </p>
        </div>
        <div className="live">
          <span className={`dot ${live ? 'dot-live' : ''}`} />
          {live ? `Actualizado en vivo a las ${formatTime(live)}` : 'Escuchando cambios en tiempo real'}
          <small>
            Proyección v{order.projectionVersion} · {formatTime(order.updatedAt)}
          </small>
        </div>
      </div>

      <OrderTimeline status={order.status} />

      {syncing && (
        <div className="alert alert-info">
          <span className="spinner" /> Tu solicitud fue aceptada (versión {awaitingVersion}). Actualizando la vista del pedido…
        </div>
      )}
      {hint && !syncing && <div className="alert alert-info">{hint}</div>}
      {order.status === 'CANCELLED' && order.statusReason && <div className="alert alert-error">Motivo: {order.statusReason}</div>}
      <DomainErrors errors={commandErrors} />

      <div className="order-grid">
        <div className="card">
          <h2>Detalle</h2>
          <table className="table">
            <tbody>
              {order.items.map((item) => (
                <tr key={item.medication.id}>
                  <td>
                    <strong>{item.medicationName}</strong>
                    <div className="muted small">{item.presentation}</div>
                    {item.requiresPrescription && <RxTag />}
                  </td>
                  <td className="num">
                    {item.quantity} × {formatMoney(item.unitPrice)}
                  </td>
                  <td className="num">{formatMoney(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="num">
                  <strong>{formatMoney(order.total)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="stack">
          {order.prescription && (
            <div className="card">
              <h2>Fórmula médica</h2>
              <PrescriptionBadge status={order.prescription.status} />
              <dl className="facts facts-compact">
                <div>
                  <dt>Médico</dt>
                  <dd>{order.prescription.doctorName}</dd>
                </div>
                <div>
                  <dt>Registro</dt>
                  <dd>{order.prescription.doctorLicense}</dd>
                </div>
                <div>
                  <dt>Código</dt>
                  <dd>{order.prescription.prescriptionCode}</dd>
                </div>
                <div>
                  <dt>Emitida</dt>
                  <dd>{order.prescription.issuedAt}</dd>
                </div>
              </dl>
              {order.prescription.notes && <p className="muted small">{order.prescription.notes}</p>}
            </div>
          )}
          {canCancel && (
            <button className="btn btn-danger btn-block" onClick={cancel} disabled={cancelling || syncing}>
              {cancelling ? 'Cancelando…' : 'Cancelar pedido'}
            </button>
          )}
        </div>
      </div>
      {loading && <p className="muted small">Actualizando…</p>}
    </section>
  );
}
