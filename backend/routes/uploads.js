const express = require('express');
const router = express.Router();
const { protect, authorize, requireApproved } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { setTenant } = require('../middleware/tenant');
const { uploadMiddleware, handleImageUpload, handleImageDelete } = require('../controllers/uploadController');

// protect primero: asi setTenant usa el tenant del usuario autenticado.
router.use(protect);
router.use(setTenant);
router.use(authorize('host', 'organizer', 'admin'));

router.use(requireApproved);

router.post('/image', uploadLimiter, uploadMiddleware, handleImageUpload);
router.delete('/image/:public_id', handleImageDelete);

module.exports = router;
