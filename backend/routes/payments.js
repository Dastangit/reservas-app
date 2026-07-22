const express = require('express');
const { createInvoice } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');

const router = express.Router();

router.use(setTenant);
router.use(protect);

router.post('/create-invoice', createInvoice);

module.exports = router;
