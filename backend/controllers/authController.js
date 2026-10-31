const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { authenticator } = require('otplib');

// TOTP estandar (RFC 6238, 30 s, 6 digitos). window 1 tolera 30 s de desfase.
authenticator.options = { window: 1 };
const TOTP_STEP_SECONDS = 30;

// Devuelve el paso de tiempo del codigo si es valido, o null. Sirve para
// impedir reutilizar un mismo codigo (replay) dentro de su ventana.
const verifyTotpStep = (code, secret) => {
  if (!secret || !/^\d{6}$/.test(code)) return null;
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) return null;
  return Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) + delta;
};
const qrcode = require('qrcode');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const env = require('../config/env');
const { logAdminAction } = require('../utils/auditLog');
const { notifyAdmins } = require('../utils/pushNotifications');

const bcrypt = require('bcryptjs');

// Hash de una contrasena aleatoria: solo se usa para igualar tiempos en login.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

const hashBackupCode = (code) => crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');

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

    if (role === 'organizer' && !phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required to register as an organizer' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const tenant = await Tenant.findOne({ domain: env.defaultTenantDomain });
    if (!tenant) {
      return res.status(503).json({ success: false, error: 'Tenant not configured' });
    }

    const userRole = role || 'tourist';

    // Hosts y organizadores necesitan aprobacion del admin: no se les entrega
    // sesion hasta entonces (el login tambien lo exige).
    if (userRole !== 'tourist') {
      const user = await User.create({
        email,
        password_hash: password,
        name,
        phone,
        role: userRole,
        tenant_id: tenant._id,
      });

      notifyAdmins(tenant._id, {
        title: userRole === 'host' ? 'Nuevo anfitrion por aprobar' : 'Nuevo organizador por aprobar',
        body: `${user.name} (${user.email}) se registro y espera aprobacion.`,
        url: userRole === 'host' ? '/admin/users' : '/admin/organizers',
      });

      return res.status(201).json({
        success: true,
        data: { user_id: user._id, role: user.role, pending_approval: true },
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
      role: userRole,
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
        tourist_onboarding: user.tourist_onboarding,
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
    // Se compara siempre contra un hash (aunque el usuario no exista) para no
    // revelar por tiempo de respuesta que emails estan registrados.
    const isMatch = user
      ? await user.comparePassword(password)
      : await bcrypt.compare(String(password), DUMMY_HASH);
    if (!user || !isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Account is not active' });
    }

    if (user.role === 'host' && user.host_status !== 'approved') {
      return res.status(403).json({ success: false, error: 'Your host account is pending admin approval. You will receive an email when approved.' });
    }

    if (user.role === 'organizer' && user.organizer_status !== 'approved') {
      return res.status(403).json({ success: false, error: 'Your organizer account is pending admin approval. You will receive an email when approved.' });
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
        name: user.name,
        tourist_onboarding: user.tourist_onboarding,
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
    const { pending_token } = req.body;
    const code = String(req.body.code || '').trim();

    if (!pending_token || !code) {
      return res.status(400).json({ success: false, error: 'pending_token and code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(pending_token, env.jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Pending token expired or invalid, please login again' });
    }

    if (decoded.purpose !== '2fa_pending') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const user = await User.findById(decoded.id).select('+two_factor.secret +two_factor.backup_codes +two_factor.last_used_step');
    if (!user || !user.two_factor?.enabled) {
      return res.status(401).json({ success: false, error: 'Invalid request' });
    }

    const totpStep = verifyTotpStep(code, user.two_factor.secret);
    // Un codigo ya usado no vale otra vez (alguien que lo vea por encima del
    // hombro no puede reutilizarlo en sus 30-60 s de validez).
    const isValidTotp = totpStep !== null && totpStep > (user.two_factor.last_used_step || 0);
    if (isValidTotp) user.two_factor.last_used_step = totpStep;

    let usedBackupCode = false;
    if (!isValidTotp) {
      const codeHash = hashBackupCode(code);
      if (user.two_factor.backup_codes?.includes(codeHash)) {
        usedBackupCode = true;
        user.two_factor.backup_codes = user.two_factor.backup_codes.filter((c) => c !== codeHash);
      }
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
        name: user.name,
        tourist_onboarding: user.tourist_onboarding,
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
    // Si ya esta activo, reconfigurarlo equivaldria a desactivarlo sin la
    // contrasena: primero hay que pasar por /2fa/disable.
    if (req.user.two_factor?.enabled) {
      return res.status(400).json({ success: false, error: '2FA is already enabled. Disable it first.' });
    }

    const secretBase32 = authenticator.generateSecret(20);
    const otpauthUrl = authenticator.keyuri(req.user.email, 'Elysio Admin', secretBase32);

    req.user.two_factor.secret = secretBase32;
    req.user.two_factor.enabled = false;
    await req.user.save();

    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

    res.json({
      success: true,
      data: { qr_code: qrDataUrl, manual_entry_key: secretBase32 },
    });
  } catch (error) {
    next(error);
  }
};

// Paso 2: confirma el código generado por la app de autenticación y recin
// ahí activa 2FA de verdad. Genera códigos de respaldo de un solo uso.
exports.enableTwoFactor = async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim();

    const user = await User.findById(req.user._id).select('+two_factor.secret');
    if (!user.two_factor?.secret) {
      return res.status(400).json({ success: false, error: 'Run 2FA setup first' });
    }

    const step = verifyTotpStep(code, user.two_factor.secret);
    const isValid = step !== null;
    if (isValid) user.two_factor.last_used_step = step;

    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid code, try again' });
    }

    const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());

    user.two_factor.enabled = true;
    // Se guardan hasheados: se muestran una sola vez al admin.
    user.two_factor.backup_codes = backupCodes.map(hashBackupCode);
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

    const decoded = jwt.verify(refresh_token, env.jwtRefreshSecret, { algorithms: ['HS256'] });
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

// Marca los pasos de onboarding del turista (bienvenida vista / términos
// vistos) -- se guarda en el servidor para que persista entre dispositivos,
// no solo en localStorage.
exports.updateOnboarding = async (req, res, next) => {
  try {
    const { field } = req.body;
    const allowedFields = ['welcome_seen', 'terms_viewed'];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ success: false, error: 'Invalid field' });
    }

    req.user.tourist_onboarding = req.user.tourist_onboarding || {};
    req.user.tourist_onboarding[field] = true;
    await req.user.save();

    res.json({ success: true, data: { tourist_onboarding: req.user.tourist_onboarding } });
  } catch (error) {
    next(error);
  }
};

// Genera un token de reset y lo guarda (hasheado) en el usuario. Como no
// hay envío automático de email, el link resultante NO se manda solo --
// queda visible para el admin en /admin/password-resets, quien lo entrega
// manualmente por WhatsApp/correo (mismo patrón que el resto de la app).
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Respuesta genérica siempre, exista o no la cuenta -- no revela qué
    // emails están registrados.
    const genericResponse = {
      success: true,
      data: { message: 'If that email is registered, our team will reach out with reset instructions shortly.' },
    };

    if (!user) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.password_reset_token = hashedToken;
    user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();

    notifyAdmins(user.tenant_id, {
      title: 'Solicitud de restablecimiento de contraseña',
      body: `${user.name} (${user.email}) solicitó recuperar su contraseña.`,
      url: '/admin/password-resets',
    });

    res.json(genericResponse);
  } catch (error) {
    next(error);
  }
};

// Confirma el reset con el token recibido por el link que el admin le mandó
// manualmente al usuario.
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({ success: false, error: 'Token and new password are required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      password_reset_token: hashedToken,
      password_reset_expires: { $gt: new Date() },
    }).select('+password_reset_token +password_reset_expires');

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset link. Please request a new one.' });
    }

    user.password_hash = new_password; // el pre-save hook del modelo lo hashea
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
    user.refresh_token = null; // fuerza a re-loguear en todos los dispositivos
    await user.save();

    res.json({ success: true, data: { message: 'Password updated successfully. You can now log in.' } });
  } catch (error) {
    next(error);
  }
};
