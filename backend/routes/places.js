const express = require('express');
const { query, oneOf } = require('express-validator');
const { getNearPlaces } = require('../controllers/placeController');
const { optionalAuth } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const router = express.Router();

// optionalAuth antes de setTenant: con sesion, el tenant sale del usuario.
router.use(optionalAuth);
router.use(setTenant);

router.get('/near', oneOf([
  query('property').isMongoId(),
  query('experience').isMongoId(),
], { message: 'property or experience id is required' }), validate, getNearPlaces);

module.exports = router;
