const express = require('express');
const { handleQvaPayWebhook } = require('../controllers/webhookController');

const router = express.Router();

router.post('/qvapay', handleQvaPayWebhook);

module.exports = router;
