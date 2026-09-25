import { ApolloProvider } from '@apollo/client/react';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import './styles.css';

/** Contexto de Apollo para TODA la app, con el cliente de la sesión actual. */
function ApolloRoot({ children }: { children: ReactNode }) {
  const { apolloClient } = useAuth();
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}

/*
 * Árbol raíz:
 *   AuthProvider      → sesión (token JWT) y cliente Apollo
 *     ApolloProvider  → caché y red de Apollo disponibles en cualquier componente
 *       BrowserRouter → rutas
 *         App         → páginas que usan useQuery / useMutation / useSubscription
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ApolloRoot>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </ApolloRoot>
    </AuthProvider>
  </StrictMode>,
);
