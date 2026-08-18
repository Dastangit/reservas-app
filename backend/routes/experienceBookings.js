const express = require('express');
const {
  getMyExperienceBookings, getExperienceBookingById, cancelExperienceBooking,
} = require('../controllers/experienceController');
const { protect } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');

const router = express.Router();

router.use(setTenant);
router.use(protect);

router.get('/', getMyExperienceBookings);
router.get('/:id', getExperienceBookingById);
router.post('/:id/cancel', cancelExperienceBooking);

module.exports = router;
