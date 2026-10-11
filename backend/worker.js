// Proceso dedicado a los crons (expiracion de holds, comisiones, recurrencias,
// ciclo de vida de reservas, recordatorios). Uso recomendado en produccion:
//   - servicio web:    npm start       con RUN_JOBS=false
//   - worker (1 sola): npm run worker
// Asi los crons no se duplican con varias instancias web y no dependen de que
// el servicio web este despierto (Render free duerme sin trafico).
require('./instrument');
const env = require('./config/env');
const connectDB = require('./config/db');
const { startAllJobs } = require('./jobs');

const start = async () => {
  env.validateEnv();
  await connectDB();
  startAllJobs();
  console.log('[Worker] Crons iniciados');
};

start().catch((err) => {
  console.error('[Worker] Error al iniciar:', err.message);
  process.exit(1);
});
