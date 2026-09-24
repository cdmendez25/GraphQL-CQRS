import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Una sola copia de graphql (la CJS que usan @graphql-tools y Apollo) para evitar
    // el error "Cannot use GraphQLSchema from another module or realm".
    alias: [{ find: /^graphql$/, replacement: 'graphql/index.js' }],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
