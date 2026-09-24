import { useQuery, useSubscription } from '@apollo/client/react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { MY_CART_QUERY, STOCK_SUBSCRIPTION } from '../graphql/operations';

function CartLink() {
  const { data } = useQuery(MY_CART_QUERY);
  const count = data?.myCart?.itemCount ?? 0;
  return (
    <NavLink to="/cart" className="nav-link">
      Carrito {count > 0 && <span className="pill">{count}</span>}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Stock en vivo en toda la app: el servidor emite { id, stockAvailable, stockStatus }
  // y la caché normalizada actualiza cada tarjeta/ficha que muestre ese Medication.
  useSubscription(STOCK_SUBSCRIPTION);

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span>
              Afirmative <strong>Pill</strong>
            </span>
          </Link>
          <nav className="nav">
            <NavLink to="/" end className="nav-link">
              Catálogo
            </NavLink>
            {user?.role === 'PATIENT' && (
              <>
                <NavLink to="/orders" className="nav-link">
                  Mis pedidos
                </NavLink>
                <CartLink />
              </>
            )}
            {user?.role === 'PHARMACIST' && (
              <NavLink to="/farmacia" className="nav-link">
                Panel farmacia
              </NavLink>
            )}
          </nav>
          <div className="session">
            {user ? (
              <>
                <span className="session-name" title={user.email}>
                  {user.fullName}
                  <small>{user.role === 'PHARMACIST' ? 'Químico farmacéutico' : 'Paciente'}</small>
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    signOut();
                    navigate('/');
                  }}
                >
                  Salir
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">
                Ingresar
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="container main">{children}</main>
      <footer className="footer container">
        Todo el tráfico cliente-servidor viaja por GraphQL en <code>/graphql</code> (HTTP para queries y mutations, WebSocket para
        subscriptions).
      </footer>
    </div>
  );
}
