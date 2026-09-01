const express = require('express');
const { search, getDestinations } = require('../controllers/searchController');
const { setTenant } = require('../middleware/tenant');

const router = express.Router();

router.use(setTenant);

router.get('/', search);
router.get('/destinations', getDestinations);

module.exports = router;
