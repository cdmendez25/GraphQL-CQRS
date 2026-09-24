/**
 * Borra y reconstruye el read model (catálogo desde el write model, pedidos
 * re-aplicando todos los eventos). Uso: npm run projections:rebuild
 */
import { closePool, newStats } from '../src/shared/db.js';
import { rebuildProjections } from '../src/projections/rebuild.js';

process.env.LOG_SQL = 'false';
const result = await rebuildProjections(newStats('rebuild'));
console.log(
  `[rebuild] ✔ ${result.medications} medicamentos proyectados · ${result.events} eventos re-aplicados · ${result.orders} pedidos proyectados`,
);
await closePool();
