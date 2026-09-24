import '@apollo/client';

// Declara (para TypeScript) el errorPolicy por defecto de las mutations:
// con 'all' la promesa de mutate() resuelve con { data, error } en vez de rechazar.
declare module '@apollo/client' {
  export namespace ApolloClient {
    export namespace DeclareDefaultOptions {
      interface Mutate {
        errorPolicy: 'all';
      }
    }
  }
}
