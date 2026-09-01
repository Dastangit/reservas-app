// Debe requerirse ANTES que express/cualquier otro módulo (ver server.js).
// Si Sentry se inicializa después de "require('express')", la
// instrumentación automática no engancha las rutas.
require('dotenv').config();
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Sin tracing de performance por ahora -- solo errores, para no gastar
    // la cuota de "performance units" del plan gratis (5k errores / 10k
    // performance units al mes). Si luego se quiere tracing, poner un
    // tracesSampleRate bajo (0.1) en vez de 1.0.
  });
  console.log('[Sentry] Inicializado');
} else {
  console.log('[Sentry] SENTRY_DSN no configurado -- monitoreo de errores deshabilitado');
}
