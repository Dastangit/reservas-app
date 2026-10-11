const express = require('express');
const { body } = require('express-validator');
const { contact } = require('../controllers/contactController');
const { optionalAuth } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const router = express.Router();

// optionalAuth antes de setTenant: con sesion, el tenant sale del usuario.
router.use(optionalAuth);
router.use(setTenant);

router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').notEmpty().withMessage('Message is required'),
], validate, contact);

module.exports = router;
