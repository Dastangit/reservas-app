const express = require('express');
const { handleNowPaymentsWebhook } = require('../controllers/webhookController');

const router = express.Router();

router.post('/nowpayments', handleNowPaymentsWebhook);

module.exports = router;
