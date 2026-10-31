const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { clientIp } = require('../utils/clientIp');

// La IP sale de utils/clientIp.js (la real del usuario cuando la peticion llega
// por Vercel con el secreto). Aun asi los limites sensibles van por IP + cuenta:
// un atacante sigue limitado por cuenta, y un usuario legitimo no queda
// bloqueado por los intentos de otros si comparte IP.
const ipKey = (req) => ipKeyGenerator(clientIp(req));
const emailKey = (req) => String(req.body?.email || '').trim().toLowerCase();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${ipKey(req)}:${emailKey(req)}`,
  message: { success: false, error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Bucket separado del de login -- probar el reset de contraseña varias
// veces no debe consumir los intentos de login de la misma IP, ni viceversa.
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${ipKey(req)}:${emailKey(req) || String(req.body?.token || '').slice(0, 16)}`,
  message: { success: false, error: 'Too many password reset attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  keyGenerator: ipKey,
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite por usuario autenticado (no por IP): protege la cuota de Cloudinary.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => String(req.user?._id || ipKey(req)),
  message: { success: false, error: 'Too many uploads, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cada llamada al webhook dispara una consulta saliente a QvaPay: se limita para
// que no se pueda usar como amplificador ni agotar el cupo de la API de QvaPay.
const webhookLimiter = rateLimit({
  keyGenerator: ipKey,
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2FA: el codigo tiene 6 digitos, asi que se limita por cuenta (el id va en
// el pending_token; decode sin verificar basta para elegir el bucket).
const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const decoded = jwt.decode(String(req.body?.pending_token || ''));
    return decoded?.id ? `user:${decoded.id}` : ipKey(req);
  },
  message: { success: false, error: 'Too many 2FA attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registro: por IP + email para frenar altas masivas sin bloquear a todos
// si la IP resulta ser compartida.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${ipKey(req)}:${emailKey(req)}`,
  message: { success: false, error: 'Too many registration attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter, passwordResetLimiter, apiLimiter, uploadLimiter, webhookLimiter, twoFactorLimiter, registerLimiter,
};
