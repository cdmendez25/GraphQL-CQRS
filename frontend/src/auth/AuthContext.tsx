import { ApolloProvider } from '@apollo/client/react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createApolloClient } from '../apollo/client';

export type Role = 'PATIENT' | 'PHARMACIST';

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

interface Session {
  token: string;
  user: SessionUser;
}

interface AuthValue {
  user: SessionUser | null;
  signIn: (session: Session) => void;
  signOut: () => void;
}

// sessionStorage: cada pestaña tiene su propia sesión (paciente y farmacéutico lado a lado en la demo).
const STORAGE_KEY = 'afirmative-pill.session';
const AuthContext = createContext<AuthValue | null>(null);

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    // El JWT trae su expiración: si venció, se descarta la sesión.
    const { exp } = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return exp * 1000 > Date.now() ? session : null;
  } catch {
    return null;
  }
}

/**
 * Proveedor raíz: guarda la sesión y monta el ApolloProvider con un cliente
 * Apollo ligado al token actual. Al iniciar/cerrar sesión se crea un cliente
 * nuevo (caché limpia + WebSocket autenticado con el nuevo token).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);
  const [apollo, setApollo] = useState(() => createApolloClient(session?.token ?? null));

  /** Cambio de sesión → se cierra el WebSocket anterior y se crea un cliente nuevo. */
  const replaceClient = useCallback(
    (token: string | null) => {
      void apollo.dispose();
      setApollo(createApolloClient(token));
    },
    [apollo],
  );

  const signIn = useCallback(
    (next: Session) => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* modo privado: la sesión vive solo en memoria */
      }
      setSession(next);
      replaceClient(next.token);
    },
    [replaceClient],
  );

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignorar */
    }
    setSession(null);
    replaceClient(null);
  }, [replaceClient]);

  const value = useMemo(() => ({ user: session?.user ?? null, signIn, signOut }), [session, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      <ApolloProvider client={apollo.client}>{children}</ApolloProvider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return value;
}
