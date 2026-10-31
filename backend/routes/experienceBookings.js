const express = require('express');
const {
  getMyExperienceBookings, getExperienceBookingById, cancelExperienceBooking,
} = require('../controllers/experienceController');
const { protect } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');

const router = express.Router();

// protect primero: asi setTenant usa el tenant del usuario autenticado.
router.use(protect);
router.use(setTenant);

router.get('/', getMyExperienceBookings);
router.get('/:id', getExperienceBookingById);
router.post('/:id/cancel', cancelExperienceBooking);

module.exports = router;
