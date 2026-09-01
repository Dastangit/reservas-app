const express = require('express');
const { createInvoice, createManualPaypalRequest, notifyManualPaymentSent } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');

const router = express.Router();

router.use(setTenant);
router.use(protect);

router.post('/create-invoice', createInvoice);
router.post('/paypal-manual', createManualPaypalRequest);
router.post('/paypal-manual/notify-sent', notifyManualPaymentSent);

module.exports = router;
