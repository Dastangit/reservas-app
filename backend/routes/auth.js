const express = require('express');
const { body } = require('express-validator');
const {
  register, login, refreshToken, logout,
  verifyTwoFactor, setupTwoFactor, enableTwoFactor, disableTwoFactor,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.post('/register', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required'),
  body('role').optional().isIn(['tourist', 'host']).withMessage('Role must be tourist or host'),
], validate, register);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validate, login);

router.post('/refresh', [
  body('refresh_token').notEmpty().withMessage('Refresh token is required'),
], validate, refreshToken);

router.post('/logout', protect, logout);

router.post('/verify-2fa', [
  body('pending_token').notEmpty().withMessage('pending_token is required'),
  body('code').notEmpty().withMessage('code is required'),
], validate, verifyTwoFactor);

router.post('/2fa/setup', protect, authorize('admin'), setupTwoFactor);
router.post('/2fa/enable', protect, authorize('admin'), [
  body('code').notEmpty().withMessage('code is required'),
], validate, enableTwoFactor);
router.post('/2fa/disable', protect, authorize('admin'), [
  body('password').notEmpty().withMessage('password is required'),
], validate, disableTwoFactor);

module.exports = router;
