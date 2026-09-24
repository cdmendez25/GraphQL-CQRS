import { useQuery } from '@apollo/client/react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RequestError } from '../components/DomainErrors';
import { formatDateTime, formatMoney } from '../components/format';
import { OrderStatusBadge, RxTag } from '../components/StatusBadge';
import { MY_ORDERS_QUERY, ORDER_STATUS_SUBSCRIPTION } from '../graphql/operations';

export function MyOrdersPage() {
  const { data, loading, error, subscribeToMore } = useQuery(MY_ORDERS_QUERY);

  // Sin orderId → el servidor envía los cambios de TODOS mis pedidos.
  // Pedidos existentes se actualizan solos (caché normalizada por Order:id);
  // uno nuevo se agrega al inicio de la lista.
  useEffect(
    () =>
      subscribeToMore({
        document: ORDER_STATUS_SUBSCRIPTION,
        variables: {},
        updateQuery: (previous, { subscriptionData }) => {
          const order = subscriptionData.data?.orderStatusChanged;
          const orders = previous.myOrders ?? [];
          if (!order || orders.some((existing) => existing?.id === order.id)) return previous as never;
          return { ...previous, myOrders: [order, ...orders] } as never;
        },
      }),
    [subscribeToMore],
  );

  if (error) return <RequestError error={error} />;
  const orders = data?.myOrders ?? [];

  return (
    <section>
      <div className="page-head">
        <h1>Mis pedidos</h1>
      </div>
      {loading && orders.length === 0 ? (
        <div className="card skeleton detail-skeleton" />
      ) : orders.length === 0 ? (
        <div className="empty card">
          Aún no tienes pedidos.{' '}
          <Link to="/" className="btn btn-primary">
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <div className="list">
          {orders.map((order) => (
            <Link key={order.id} to={`/orders/${order.id}`} className="card order-row">
              <div>
                <strong>#{order.id.slice(0, 8)}</strong>
                <div className="muted small">{formatDateTime(order.placedAt)}</div>
              </div>
              <div>{order.requiresPrescription && <RxTag />}</div>
              <div className="muted">{order.itemCount} u.</div>
              <OrderStatusBadge status={order.status} />
              <strong className="num">{formatMoney(order.total)}</strong>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
