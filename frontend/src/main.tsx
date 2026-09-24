import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import './styles.css';

/*
 * Árbol raíz de la aplicación:
 *   AuthProvider  → sesión + <ApolloProvider client={…}> (contexto Apollo para TODA la app)
 *     BrowserRouter
 *       ToastProvider
 *         App (páginas que usan useQuery / useMutation / useSubscription)
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
