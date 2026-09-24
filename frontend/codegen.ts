import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Genera tipos TypeScript a partir del MISMO schema.graphql del backend y de
 * las operaciones de src/graphql/operations.ts → hooks de Apollo tipados.
 * Uso: npm run codegen
 */
const config: CodegenConfig = {
  schema: '../backend/src/schema/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**/*'],
  ignoreNoDocuments: true,
  generates: {
    './src/gql/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        useTypeImports: true,
        nonOptionalTypename: true,
        enumsAsTypes: true,
        scalars: {
          Money: 'string',
          DateTime: 'string',
          Date: 'string',
          PositiveInt: 'number',
          SKU: 'string',
        },
      },
    },
  },
};

export default config;
