const express = require('express');
const { search, getDestinations } = require('../controllers/searchController');
const { optionalAuth } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');

const router = express.Router();

// optionalAuth antes de setTenant: con sesion, el tenant sale del usuario.
router.use(optionalAuth);
router.use(setTenant);

router.get('/', search);
router.get('/destinations', getDestinations);

module.exports = router;
