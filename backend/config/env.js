const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '1h',
  jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  qvapay: {
    appId: process.env.QVAPAY_APP_ID,
    appSecret: process.env.QVAPAY_APP_SECRET,
    apiUrl: process.env.QVAPAY_API_URL || 'https://api.qvapay.com/v2',
  },
  // Metodo manual: link de paypal.me a una cuenta de un tercero fuera de
  // Cuba (ver decision del 31-ago-2026). No hay API/webhook -- el admin
  // confirma el pago a mano despues de revisar el deposito.
  paypalManual: {
    username: process.env.PAYPAL_MANUAL_USERNAME,
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  // Dominio del tenant por defecto cuando el hostname no coincide con ninguno.
  defaultTenantDomain: process.env.DEFAULT_TENANT_DOMAIN || 'elysioexperiences.com',
};

// Falla al arrancar si falta algo imprescindible, en vez de romper en la
// primera peticion (p. ej. jwt.sign sin secreto).
module.exports.validateEnv = () => {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos');
  }
};
