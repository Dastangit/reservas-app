const express = require('express');
const { query } = require('express-validator');
const { search } = require('../controllers/geoController');
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const router = express.Router();

// Solo quien publica (anfitrion, organizador, admin): el servicio de
// OpenStreetMap es gratis y compartido, no para el publico general.
router.use(protect);
router.use(setTenant);
router.use(authorize('host', 'organizer', 'admin'));

router.get('/search', [
  query('q').isString().trim().isLength({ min: 3, max: 200 }).withMessage('Query must be 3-200 characters'),
], validate, search);

module.exports = router;
