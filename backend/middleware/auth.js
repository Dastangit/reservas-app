const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

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

module.exports = { protect, authorize };
