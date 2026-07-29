const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const { getVapidPublicKey, subscribe, unsubscribe } = require('../controllers/pushController');

// La clave p\u00fablica no es sensible, pero igual la dejamos protegida por admin
// para no exponer innecesariamente que existe este sistema.
router.get('/vapid-public-key', protect, authorize('admin'), getVapidPublicKey);
router.post('/subscribe', setTenant, protect, authorize('admin'), subscribe);
router.post('/unsubscribe', protect, authorize('admin'), unsubscribe);

module.exports = router;
