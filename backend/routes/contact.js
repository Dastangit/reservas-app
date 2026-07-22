const express = require('express');
const { body } = require('express-validator');
const { contact } = require('../controllers/contactController');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(setTenant);

router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').notEmpty().withMessage('Message is required'),
], validate, contact);

module.exports = router;
