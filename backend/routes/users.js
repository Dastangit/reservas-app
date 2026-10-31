const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const {
  getProfile,
  updateProfile,
  changePassword,
  getUserById,
  getUsers,
} = require('../controllers/userController');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/change-password', protect, changePassword);
router.get('/', protect, setTenant, authorize('admin'), getUsers);
router.get('/:id', protect, setTenant, authorize('admin'), getUserById);

module.exports = router;
