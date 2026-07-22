const express = require('express');
const { search } = require('../controllers/searchController');
const { setTenant } = require('../middleware/tenant');

const router = express.Router();

router.use(setTenant);

router.get('/', search);

module.exports = router;
