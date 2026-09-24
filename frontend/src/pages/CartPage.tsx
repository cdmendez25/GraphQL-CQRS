import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DomainErrors, fieldErrors, RequestError } from '../components/DomainErrors';
import { formatMoney, multiplyMoney, sumMoney, todayIso } from '../components/format';
import { RxTag } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import type { CartFieldsFragment, DomainErrorFieldsFragment } from '../gql/graphql';
import {
  CHECKOUT_MUTATION,
  MY_CART_QUERY,
  REMOVE_CART_ITEM_MUTATION,
  UPDATE_CART_ITEM_MUTATION,
} from '../graphql/operations';

/** Recalcula el carrito localmente para la respuesta optimista (UI instantánea). */
function optimisticCart(cart: CartFieldsFragment, medicationId: string, quantity: number | null): CartFieldsFragment {
  const items = cart.items
    .map((item) =>
      item.medication.id === medicationId && quantity !== null
        ? { ...item, quantity, lineTotal: multiplyMoney(item.medication.price, quantity) }
        : item,
    )
    .filter((item) => quantity !== null || item.medication.id !== medicationId);
  return {
    ...cart,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: sumMoney(items.map((item) => item.lineTotal)),
    requiresPrescription: items.some((item) => item.medication.requiresPrescription),
  };
}

const EMPTY_PRESCRIPTION = { doctorName: '', doctorLicense: '', prescriptionCode: '', issuedAt: todayIso() };

export function CartPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error } = useQuery(MY_CART_QUERY);
  const cart = data?.myCart;
  const [prescription, setPrescription] = useState(EMPTY_PRESCRIPTION);
  const [checkoutErrors, setCheckoutErrors] = useState<DomainErrorFieldsFragment[]>([]);

  const [updateItem] = useMutation(UPDATE_CART_ITEM_MUTATION);
  const [removeItem] = useMutation(REMOVE_CART_ITEM_MUTATION);
  const [checkout, { loading: checkingOut }] = useMutation(CHECKOUT_MUTATION);

  if (loading && !cart) return <div className="card skeleton detail-skeleton" />;
  if (error) return <RequestError error={error} />;
  if (!cart || cart.items.length === 0) {
    return (
      <div className="empty card">
        <h2>Tu carrito está vacío</h2>
        <Link to="/" className="btn btn-primary">
          Explorar el catálogo
        </Link>
      </div>
    );
  }

  const changeQuantity = async (medicationId: string, quantity: number) => {
    if (quantity < 1) return;
    const { data: result } = await updateItem({
      variables: { input: { medicationId, quantity } },
      // La caché se actualiza de inmediato; si el servidor rechaza, Apollo revierte.
      optimisticResponse: {
        __typename: 'Mutation',
        updateCartItemQuantity: { __typename: 'CartPayload', cart: optimisticCart(cart, medicationId, quantity), errors: [] },
      },
    });
    const errors = result?.updateCartItemQuantity.errors;
    if (errors?.length) toast(errors[0].message, 'error');
  };

  const remove = async (medicationId: string) => {
    await removeItem({
      variables: { input: { medicationId } },
      optimisticResponse: {
        __typename: 'Mutation',
        removeItemFromCart: { __typename: 'CartPayload', cart: optimisticCart(cart, medicationId, null), errors: [] },
      },
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setCheckoutErrors([]);
    const { data: result, error: requestError } = await checkout({
      variables: { input: { prescription: cart.requiresPrescription ? prescription : null } },
      update(cache, { data: payload }) {
        if (!payload?.checkoutCart.receipt) return;
        // 1) El carrito ya se convirtió en pedido → la query MyCart pasa a null.
        cache.modify({ fields: { myCart: () => null } });
        // 2) Reflejamos la reserva de stock al instante; el valor definitivo
        //    llegará por la subscription stockChanged cuando el proyector termine.
        for (const item of cart.items) {
          cache.modify({
            id: cache.identify({ __typename: 'Medication', id: item.medication.id }),
            fields: { stockAvailable: (current: number) => Math.max(0, current - item.quantity) },
          });
        }
      },
    });
    if (requestError) {
      toast(requestError.message, 'error');
      return;
    }
    const payload = result?.checkoutCart;
    if (payload?.receipt) {
      toast('Pedido recibido. Generando la vista del pedido…', 'success');
      navigate(`/orders/${payload.receipt.orderId}`, { state: { receipt: payload.receipt } });
    } else if (payload) {
      setCheckoutErrors(payload.errors);
    }
  };

  const fields = fieldErrors(checkoutErrors);
  const setField = (name: keyof typeof prescription) => (event: { target: { value: string } }) =>
    setPrescription((current) => ({ ...current, [name]: event.target.value }));

  return (
    <section className="cart-layout">
      <div>
        <h1>Tu carrito</h1>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Medicamento</th>
                <th>Cantidad</th>
                <th className="num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cart.items.map((item) => (
                <tr key={item.medication.id}>
                  <td>
                    <Link to={`/medications/${item.medication.id}`}>
                      <strong>{item.medication.name}</strong>
                    </Link>
                    <div className="muted small">
                      {item.medication.presentation} · {formatMoney(item.medication.price)} c/u
                    </div>
                    {item.medication.requiresPrescription && <RxTag />}
                  </td>
                  <td>
                    <div className="stepper">
                      <button onClick={() => changeQuantity(item.medication.id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Menos">
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => changeQuantity(item.medication.id, item.quantity + 1)}
                        disabled={item.quantity >= item.medication.stockAvailable}
                        aria-label="Más"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="num">{formatMoney(item.lineTotal)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(item.medication.id)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form className="card checkout" onSubmit={submit}>
        <h2>Confirmar pedido</h2>
        <div className="summary-row">
          <span>{cart.itemCount} unidad(es)</span>
          <strong className="price price-lg">{formatMoney(cart.subtotal)}</strong>
        </div>

        {cart.requiresPrescription && (
          <fieldset className="prescription">
            <legend>℞ Datos de la fórmula médica</legend>
            <p className="muted small">Tu carrito incluye medicamentos que requieren fórmula. Sin estos datos el pedido no puede aprobarse.</p>
            <label className="field">
              <span>Nombre del médico</span>
              <input className="input" value={prescription.doctorName} onChange={setField('doctorName')} required />
              {fields['prescription.doctorName'] && <em className="field-error">{fields['prescription.doctorName']}</em>}
            </label>
            <label className="field">
              <span>Registro médico (ReTHUS)</span>
              <input className="input" inputMode="numeric" value={prescription.doctorLicense} onChange={setField('doctorLicense')} required />
              {fields['prescription.doctorLicense'] && <em className="field-error">{fields['prescription.doctorLicense']}</em>}
            </label>
            <label className="field">
              <span>Código de la fórmula</span>
              <input className="input" value={prescription.prescriptionCode} onChange={setField('prescriptionCode')} required />
              {fields['prescription.prescriptionCode'] && <em className="field-error">{fields['prescription.prescriptionCode']}</em>}
            </label>
            <label className="field">
              <span>Fecha de emisión</span>
              <input className="input" type="date" max={todayIso()} value={prescription.issuedAt} onChange={setField('issuedAt')} required />
              {fields['prescription.issuedAt'] && <em className="field-error">{fields['prescription.issuedAt']}</em>}
            </label>
          </fieldset>
        )}

        <DomainErrors errors={checkoutErrors.filter((error) => error.__typename !== 'ValidationError' || !error.field.startsWith('prescription.'))} />

        <button className="btn btn-primary btn-block" type="submit" disabled={checkingOut}>
          {checkingOut ? 'Reservando stock…' : 'Confirmar pedido'}
        </button>
        <p className="muted small">El stock se reserva de forma atómica al confirmar. Si otro paciente compra antes, te avisaremos.</p>
      </form>
    </section>
  );
}
