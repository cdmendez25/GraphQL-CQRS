import { createServer } from 'node:http';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import cors from 'cors';
import express from 'express';
import { useServer } from 'graphql-ws/use/ws';
import { WebSocketServer } from 'ws';
import { schema } from './schema/index.js';
import { env } from './shared/config.js';
import { buildContext, type GraphQLContext } from './shared/context.js';
import { closePool, getPool } from './shared/db.js';
import { queryStatsPlugin } from './shared/queryStatsPlugin.js';
import { Projector } from './projections/projector.js';
import { startOrderProcessManager } from './workers/orderProcessManager.js';

const GRAPHQL_PATH = '/graphql';

const app = express();
app.disable('x-powered-by');
const httpServer = createServer(app);

// Subscriptions: GraphQL sobre WebSocket (protocolo graphql-ws) en la MISMA ruta /graphql.
const wsServer = new WebSocketServer({ server: httpServer, path: GRAPHQL_PATH });
const wsCleanup = useServer<Record<string, unknown>>(
  {
    schema,
    context: (ctx) => buildContext(ctx.connectionParams?.authorization, 'ws'),
  },
  wsServer,
);

const server = new ApolloServer<GraphQLContext>({
  schema,
  introspection: true,
  includeStacktraceInErrorResponses: false,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    { async serverWillStart() { return { async drainServer() { await wsCleanup.dispose(); } }; } },
    queryStatsPlugin,
  ],
});

await server.start();

app.use(
  GRAPHQL_PATH,
  cors({ origin: env.corsOrigin }),
  express.json({ limit: '1mb' }),
  expressMiddleware(server, {
    context: async ({ req }) => buildContext(req.headers.authorization),
  }),
);

// Zero-REST: no existe ninguna otra ruta HTTP.
app.use((_req, res) => {
  res.status(404).type('text/plain').send('Afirmative Pill solo expone GraphQL en /graphql');
});

await getPool().query('SELECT 1'); // falla rápido si DATABASE_URL es incorrecta
new Projector().start();
await startOrderProcessManager();

httpServer.listen(env.port, () => {
  console.log(`🚀 GraphQL (queries + mutations)  http://localhost:${env.port}${GRAPHQL_PATH}`);
  console.log(`🔌 GraphQL (subscriptions)        ws://localhost:${env.port}${GRAPHQL_PATH}`);
  console.log(`   DataLoader: ${env.dataloaderEnabled ? 'ACTIVADO' : 'DESACTIVADO (modo N+1)'} · latencia del proyector: ${env.projectionDelayMs}ms`);
});

async function shutdown() {
  await server.stop();
  await closePool();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
