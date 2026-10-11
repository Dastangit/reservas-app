require('./instrument');
console.log('[Server] Starting...');

const connectDB = require('./config/db');
const env = require('./config/env');
const { startAllJobs } = require('./jobs');
const app = require('./app');

const startServer = async () => {
  env.validateEnv();
  await connectDB();

  const PORT = env.port;
  app.listen(PORT, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${PORT}`);
    // RUN_JOBS=false cuando los crons corren en worker.js (proceso aparte).
    if (process.env.RUN_JOBS !== 'false') {
      startAllJobs();
    } else {
      console.log('[Server] Crons desactivados (RUN_JOBS=false), los corre worker.js');
    }
  });
};

startServer().catch((err) => {
  console.error('[Server] Error al iniciar:', err.message);
  process.exit(1);
});

module.exports = app;
