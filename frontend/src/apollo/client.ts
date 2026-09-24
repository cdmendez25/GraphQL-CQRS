import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { relayStylePagination } from '@apollo/client/utilities';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';

/** Único endpoint del backend. En desarrollo Vite lo reenvía a localhost:4000. */
const GRAPHQL_PATH = import.meta.env.VITE_GRAPHQL_URL ?? '/graphql';

const wsUrl = () => {
  const url = new URL(GRAPHQL_PATH, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
};

/**
 * Caché normalizada: cada Medication/Order/Cart se guarda una sola vez por
 * `__typename:id`. Cuando una mutation o una subscription devuelve un objeto
 * con el mismo id, TODAS las pantallas que lo muestran se actualizan solas.
 */
export function createCache() {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Paginación por cursor: las páginas se concatenan por combinación de filtro + orden.
          medications: relayStylePagination(['filter', 'sort']),
          // Estas listas siempre llegan completas: la nueva versión reemplaza a la anterior.
          myOrders: { merge: false },
          pharmacyQueue: { merge: false },
        },
      },
    },
  });
}

/**
 * Se crea un cliente por sesión (token): así el caché nunca mezcla datos de
 * dos usuarios y la conexión WebSocket se abre con el token correcto.
 */
export function createApolloClient(token: string | null) {
  const authorization = token ? `Bearer ${token}` : '';

  const authLink = new SetContextLink((prevContext) => ({
    headers: { ...prevContext.headers, ...(authorization ? { authorization } : {}) },
  }));

  const httpLink = new HttpLink({ uri: GRAPHQL_PATH });

  const wsClient = createClient({
    url: wsUrl(),
    lazy: true,
    connectionParams: () => (authorization ? { authorization } : {}),
    retryAttempts: Infinity,
  });
  const wsLink = new GraphQLWsLink(wsClient);

  // Queries y mutations → HTTP POST /graphql · Subscriptions → WebSocket /graphql
  const link = ApolloLink.split(
    ({ operationType }) => operationType === OperationTypeNode.SUBSCRIPTION,
    wsLink,
    authLink.concat(httpLink),
  );

  const client = new ApolloClient({
    link,
    cache: createCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network' },
      // Los errores de negocio llegan en `payload.errors`; los técnicos en `error`.
      mutate: { errorPolicy: 'all' },
    },
  });

  return { client, dispose: () => wsClient.dispose() };
}
