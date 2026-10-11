// La aplicacion Express (rutas y middlewares). No se conecta a la base ni
// arranca crons: eso lo hace server.js. Los tests la usan con supertest.
const Sentry = require('./instrument');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const env = require('./config/env');
const { apiLimiter, webhookLimiter } = require('./middleware/rateLimiter');

const app = express();

// Confiamos solo en el primer salto de proxy (el de Render) -- "true"
// confiaba en toda la cadena, lo cual permite falsificar X-Forwarded-For y
// saltarse el rate limiting de login. "1" es el valor correcto para un
// servicio detrás de exactamente un proxy inverso.
app.set('trust proxy', 1);

// Morgan PRIMERO — para capturar TODAS las requests (incluyendo OPTIONS
// de CORS preflight) antes de que cors/helmet las consuman. En produccion se
// registra solo la ruta (sin query string, que puede llevar tokens).
if (env.nodeEnv === 'production') {
  morgan.token('path', (req) => req.originalUrl.split('?')[0]);
  app.use(morgan(':remote-addr :method :path :status :res[content-length] - :response-time ms'));
} else if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.use(helmet());

// El frontend se sirve desde Vercel con proxy (/api/* → backend), asi que en
// produccion el navegador habla siempre con el mismo origen. Solo se permiten
// el frontend oficial y, fuera de produccion, los origenes de desarrollo local.
const allowedOrigins = [env.frontendUrl, 'https://reservas-app-blue.vercel.app']
  .filter(Boolean)
  .map((url) => url.replace(/\/+$/, ''));

const localDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):\d+$/;
app.use(cors({
  origin: (origin, callback) => {
    // Sin Origin: peticiones servidor a servidor (proxy de Vercel, middleware,
    // health checks, curl). No son peticiones CORS de navegador.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (env.nodeEnv !== 'production' && localDevOrigin.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));
// Las imagenes van por multipart (multer), asi que el JSON nunca necesita ser grande.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
// Limpia cualquier operador Mongo ($gt, $ne, etc.) de body/query/params antes
// de que llegue a Mongoose -- previene NoSQL injection.
app.use(mongoSanitize());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', apiLimiter, require('./routes/auth'));
app.use('/api/properties', apiLimiter, require('./routes/properties'));
app.use('/api/bookings', apiLimiter, require('./routes/bookings'));
app.use('/api/reviews', apiLimiter, require('./routes/reviews'));
app.use('/api/feedback', apiLimiter, require('./routes/feedback'));
app.use('/api/users', apiLimiter, require('./routes/users'));
app.use('/api/admin', apiLimiter, require('./routes/admin'));
app.use('/api/search', apiLimiter, require('./routes/search'));
app.use('/api/contact', apiLimiter, require('./routes/contact'));
app.use('/api/payments', apiLimiter, require('./routes/payments'));
app.use('/api/uploads', apiLimiter, require('./routes/uploads'));
app.use('/api/push', apiLimiter, require('./routes/push'));
app.use('/api/experiences', apiLimiter, require('./routes/experiences'));
app.use('/api/experience-bookings', apiLimiter, require('./routes/experienceBookings'));
app.use('/api/organizer', apiLimiter, require('./routes/organizer'));
app.use('/api/webhooks', webhookLimiter, require('./routes/webhooks'));

app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});

// Sentry captura los errores antes de que nuestro errorHandler responda.
if (Sentry && typeof Sentry.setupExpressErrorHandler === 'function') {
  Sentry.setupExpressErrorHandler(app);
}

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
