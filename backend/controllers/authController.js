const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const env = require('../config/env');
const { logAdminAction } = require('../utils/auditLog');

const generateToken = (id) => {
  return jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpire });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpire });
};

const generatePendingTwoFactorToken = (id) => {
  // Token de vida corta (5 min), distinto del token de sesión real -- solo
  // sirve para completar el segundo paso del login, no da acceso a nada.
  return jwt.sign({ id, purpose: '2fa_pending' }, env.jwtSecret, { expiresIn: '5m' });
};

exports.register = async (req, res, next) => {
  try {
    const { email, password, name, phone, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    let tenant = await Tenant.findOne({ domain: 'daelworldtravelers.com' });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Da-El World Travelers',
        domain: 'daelworldtravelers.com',
        admin_email: 'supportdaelworld@gmail.com',
      });
    }

    const refreshTokenPlaceholderId = new mongoose.Types.ObjectId();
    const refreshToken = generateRefreshToken(refreshTokenPlaceholderId);

    const user = await User.create({
      _id: refreshTokenPlaceholderId,
      email,
      password_hash: password,
      name,
      phone,
      role: role || 'tourist',
      tenant_id: tenant._id,
      refresh_token: refreshToken,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        user_id: user._id,
        token,
        refresh_token: refreshToken,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password_hash');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Account is not active' });
    }

    if (user.role === 'host' && user.host_status !== 'approved') {
      return res.status(403).json({ success: false, error: 'Your host account is pending admin approval. You will receive an email when approved.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Si el usuario tiene 2FA activo, no se entrega el token real todavía --
    // se pide el segundo paso (código TOTP) antes de dar acceso.
    if (user.two_factor?.enabled) {
      const pendingToken = generatePendingTwoFactorToken(user._id);
      return res.json({
        success: true,
        data: { requires_2fa: true, pending_token: pendingToken },
      });
    }

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.auth.last_login = new Date();
    user.auth.login_count += 1;
    user.refresh_token = refreshToken;
    await user.save();

    res.json({
      success: true,
      data: {
        user_id: user._id,
        token,
        refresh_token: refreshToken,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Segundo paso del login cuando el usuario tiene 2FA activo: recibe el
// pending_token del primer paso + el código TOTP de 6 dígitos (o un código
// de respaldo), y si es válido, ahí sí entrega el token real de sesión.
exports.verifyTwoFactor = async (req, res, next) => {
  try {
    const { pending_token, code } = req.body;

    if (!pending_token || !code) {
      return res.status(400).json({ success: false, error: 'pending_token and code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(pending_token, env.jwtSecret);
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Pending token expired or invalid, please login again' });
    }

    if (decoded.purpose !== '2fa_pending') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const user = await User.findById(decoded.id).select('+two_factor.secret +two_factor.backup_codes');
    if (!user || !user.two_factor?.enabled) {
      return res.status(401).json({ success: false, error: 'Invalid request' });
    }

    const isValidTotp = speakeasy.totp.verify({
      secret: user.two_factor.secret,
      encoding: 'base32',
      token: code,
      window: 1, // tolera 30s de desfase de reloj
    });

    let usedBackupCode = false;
    if (!isValidTotp && user.two_factor.backup_codes?.includes(code)) {
      usedBackupCode = true;
      user.two_factor.backup_codes = user.two_factor.backup_codes.filter((c) => c !== code);
    }

    if (!isValidTotp && !usedBackupCode) {
      return res.status(401).json({ success: false, error: 'Invalid 2FA code' });
    }

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.auth.last_login = new Date();
    user.auth.login_count += 1;
    user.refresh_token = refreshToken;
    await user.save();

    res.json({
      success: true,
      data: {
        user_id: user._id,
        token,
        refresh_token: refreshToken,
        role: user.role,
        used_backup_code: usedBackupCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Paso 1 de activación: genera un secreto TOTP nuevo (aún no activo) y
// devuelve el QR para escanear con Google Authenticator / Authy.
exports.setupTwoFactor = async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Da-El Admin (${req.user.email})`,
    });

    req.user.two_factor.secret = secret.base32;
    req.user.two_factor.enabled = false;
    await req.user.save();

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      success: true,
      data: { qr_code: qrDataUrl, manual_entry_key: secret.base32 },
    });
  } catch (error) {
    next(error);
  }
};

// Paso 2: confirma el código generado por la app de autenticación y recin
// ahí activa 2FA de verdad. Genera códigos de respaldo de un solo uso.
exports.enableTwoFactor = async (req, res, next) => {
  try {
    const { code } = req.body;

    const user = await User.findById(req.user._id).select('+two_factor.secret');
    if (!user.two_factor?.secret) {
      return res.status(400).json({ success: false, error: 'Run 2FA setup first' });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.two_factor.secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid code, try again' });
    }

    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).slice(2, 10).toUpperCase()
    );

    user.two_factor.enabled = true;
    user.two_factor.backup_codes = backupCodes;
    await user.save();

    await logAdminAction({
      admin_id: user._id,
      tenant_id: user.tenant_id,
      action: '2fa_enabled',
      target_type: 'User',
      target_id: user._id,
    });

    res.json({
      success: true,
      data: { enabled: true, backup_codes: backupCodes },
    });
  } catch (error) {
    next(error);
  }
};

// Desactivar 2FA -- pide el password de nuevo como confirmación, para que
// no baste con tener la sesión abierta en un dispositivo robado.
exports.disableTwoFactor = async (req, res, next) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.user._id).select('+password_hash');
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }

    user.two_factor.enabled = false;
    user.two_factor.secret = undefined;
    user.two_factor.backup_codes = [];
    await user.save();

    await logAdminAction({
      admin_id: user._id,
      tenant_id: user.tenant_id,
      action: '2fa_disabled',
      target_type: 'User',
      target_id: user._id,
    });

    res.json({ success: true, data: { enabled: false } });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, _next) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refresh_token, env.jwtRefreshSecret);
    const user = await User.findById(decoded.id).select('+refresh_token');

    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }

    if (user.refresh_token !== refresh_token) {
      return res.status(401).json({ success: false, error: 'Refresh token has been revoked' });
    }

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refresh_token = newRefreshToken;
    await user.save();

    res.json({ success: true, data: { token: newToken, refresh_token: newRefreshToken } });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
};

exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refresh_token: null });
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
