import { useMutation } from '@apollo/client/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ADD_TO_CART_MUTATION, MY_CART_QUERY } from '../graphql/operations';
import { useToast } from './Toast';

interface Props {
  medicationId: string;
  quantity?: number;
  disabled?: boolean;
  compact?: boolean;
}

/** Botón que ejecuta el comando addItemToCart y actualiza la caché del carrito. */
export function AddToCartButton({ medicationId, quantity = 1, disabled, compact }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [addItem, { loading }] = useMutation(ADD_TO_CART_MUTATION, {
    // Si el paciente aún no tenía carrito, la query MyCart estaba en null:
    // escribimos el carrito devuelto por el comando para que el contador del
    // header y la página del carrito se actualicen sin volver a consultar.
    update(cache, { data }) {
      const cart = data?.addItemToCart.cart;
      if (cart) cache.writeQuery({ query: MY_CART_QUERY, data: { __typename: 'Query', myCart: cart } });
    },
  });

  if (!user) {
    return (
      <Link className={`btn btn-secondary ${compact ? 'btn-sm' : ''}`} to="/login">
        Inicia sesión para comprar
      </Link>
    );
  }
  if (user.role !== 'PATIENT') return null;

  const onClick = async () => {
    const { data, error } = await addItem({ variables: { input: { medicationId, quantity } } });
    const payload = data?.addItemToCart;
    if (error) toast(error.message, 'error');
    else if (payload?.errors.length) toast(payload.errors[0].message, 'error');
    else toast(`Agregado al carrito (${quantity} u.)`, 'success');
  };

  return (
    <button className={`btn btn-primary ${compact ? 'btn-sm' : ''}`} onClick={onClick} disabled={disabled || loading}>
      {loading ? 'Agregando…' : 'Agregar al carrito'}
    </button>
  );
}
