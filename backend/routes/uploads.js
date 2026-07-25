const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const { uploadMiddleware, handleImageUpload, handleImageDelete } = require('../controllers/uploadController');

router.use(setTenant);
router.use(protect);
router.use(authorize('host', 'admin'));

router.post('/image', uploadMiddleware, handleImageUpload);
router.delete('/image/:public_id', handleImageDelete);

module.exports = router;
