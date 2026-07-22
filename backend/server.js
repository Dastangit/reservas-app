console.log('[Server] Starting...');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
const env = require('./config/env');
const { loginLimiter, apiLimiter } = require('./middleware/rateLimiter');
const { startHoldExpiryCron } = require('./jobs/holdExpiry');
const { startHostCommissionCron } = require('./jobs/hostCommissionCron');

const app = express();

// Necesario porque SnapDeploy pone un proxy (Cloudflare) delante del
// contenedor -- sin esto, express-rate-limit no puede determinar la IP real
// del usuario a partir de X-Forwarded-For y lanza una excepción que tumba el
// proceso completo (fue justo lo que causó el 502 "Host Error").
app.set('trust proxy', true);

// Morgan PRIMERO — para capturar TODAS las requests (incluyendo OPTIONS
// de CORS preflight) antes de que cors/helmet las consuman.
app.use(morgan('dev'));

app.use(helmet());

// Ahora el frontend se sirve desde Vercel con proxy (/api/* → backend),
// así que las peticiones de producción llegan sin Origin cross-domain.
// Solo mantenemos CORS abierto para desarrollo local.
const localDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):\d+$/;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || localDevOrigin.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Limpia cualquier operador Mongo ($gt, $ne, etc.) de body/query/params antes
// de que llegue a Mongoose -- previene NoSQL injection.
app.use(mongoSanitize());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', loginLimiter, require('./routes/auth'));
app.use('/api/properties', apiLimiter, require('./routes/properties'));
app.use('/api/bookings', apiLimiter, require('./routes/bookings'));
app.use('/api/reviews', apiLimiter, require('./routes/reviews'));
app.use('/api/feedback', apiLimiter, require('./routes/feedback'));
app.use('/api/users', apiLimiter, require('./routes/users'));
app.use('/api/admin', apiLimiter, require('./routes/admin'));
app.use('/api/search', apiLimiter, require('./routes/search'));
app.use('/api/contact', apiLimiter, require('./routes/contact'));
app.use('/api/payments', apiLimiter, require('./routes/payments'));
app.use('/api/webhooks', require('./routes/webhooks'));

app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const startServer = async () => {
  await connectDB();

  const PORT = env.port;
  app.listen(PORT, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${PORT}`);
    startHoldExpiryCron();
    startHostCommissionCron();
  });
};

startServer().catch((err) => {
  console.error('[Server] Error al iniciar:', err.message);
  process.exit(1);
});

module.exports = app;
