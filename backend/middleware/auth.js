const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

const getBearerToken = (req) => {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.split(' ')[1] : null;
};

const protect = async (req, res, next) => {
  // optionalAuth ya pudo haber cargado al usuario en esta misma peticion.
  if (req.user) return next();

  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });

    // El pending_token del 2FA (purpose: '2fa_pending') se firma con el mismo
    // secreto pero NO es una sesion: solo sirve en /api/auth/verify-2fa.
    if (decoded.purpose) {
      return res.status(401).json({ success: false, error: 'Not authorized, token invalid' });
    }

    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized, user not found' });
    }

    if (req.user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Account is not active' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Not authorized, token invalid' });
  }
};

// Para rutas publicas que muestran mas datos al dueno/admin: si hay un token
// de sesion valido carga req.user; si no, sigue como anonimo (nunca responde 401).
const optionalAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    if (!decoded.purpose) {
      const user = await User.findById(decoded.id);
      if (user && user.status === 'active') req.user = user;
    }
  } catch (_error) {
    // token vencido o invalido: se trata como anonimo
  }
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Hosts y organizadores solo operan (subir archivos, etc.) cuando el admin los aprobo.
// El login ya lo exige, pero el token que se entrega al registrarse existe antes.
const requireApproved = (req, res, next) => {
  const { role, host_status: hostStatus, organizer_status: organizerStatus } = req.user;
  if ((role === 'host' && hostStatus !== 'approved') || (role === 'organizer' && organizerStatus !== 'approved')) {
    return res.status(403).json({ success: false, error: 'Your account is pending approval' });
  }
  next();
};

module.exports = { protect, optionalAuth, authorize, requireApproved };
