require('./instrument');
console.log('[Server] Starting...');

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const env = require('./config/env');
const { startAllJobs } = require('./jobs');
const app = require('./app');

const startServer = async () => {
  env.validateEnv();
  await connectDB();

  const PORT = env.port;
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${PORT}`);
    // RUN_JOBS=false cuando los crons corren en worker.js (proceso aparte).
    if (process.env.RUN_JOBS !== 'false') {
      startAllJobs();
    } else {
      console.log('[Server] Crons desactivados (RUN_JOBS=false), los corre worker.js');
    }
  });

  // Apagado limpio en redeploys: deja terminar las peticiones en curso y
  // cierra la conexion a Mongo antes de salir.
  const shutdown = (signal) => {
    console.log(`[Server] ${signal} recibido, cerrando...`);
    server.close(() => {
      mongoose.connection.close(false).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((err) => {
  console.error('[Server] Error al iniciar:', err.message);
  process.exit(1);
});

module.exports = app;
