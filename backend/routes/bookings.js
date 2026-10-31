const express = require('express');
const { body } = require('express-validator');
const {
  createBooking, getMyBookings, getHostBookings,
  getBookingById, cancelBooking, approveBooking,
  rejectBooking, completeBooking,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STAY_NIGHTS = 365;

const router = express.Router();

// protect primero: asi setTenant usa el tenant del usuario autenticado.
router.use(protect);
router.use(setTenant);

router.post('/', authorize('tourist'), [
  body('property_id').notEmpty().withMessage('Property ID is required'),
  body('check_in').isISO8601().withMessage('Check-in date is required')
    .custom((value) => {
      // Un dia de margen: el turista puede estar en una zona horaria detras de UTC.
      const startOfTodayUtc = new Date(new Date().toISOString().slice(0, 10)).getTime();
      if (new Date(value).getTime() < startOfTodayUtc - DAY_MS) {
        throw new Error('Check-in date cannot be in the past');
      }
      return true;
    }),
  body('check_out').isISO8601().withMessage('Check-out date is required')
    .custom((value, { req }) => {
      const nights = (new Date(value) - new Date(req.body.check_in)) / DAY_MS;
      if (!(nights > 0)) throw new Error('Check-out must be after check-in');
      if (nights > MAX_STAY_NIGHTS) throw new Error(`Maximum stay is ${MAX_STAY_NIGHTS} nights`);
      return true;
    }),
  body('num_guests').isInt({ min: 1 }).withMessage('Number of guests must be at least 1'),
  body('booking_type').isIn(['pre_booking']).withMessage('Invalid booking type'),
  body('payment_option').isIn(['full_payment', 'daily_payment']).withMessage('Invalid payment option'),
  body('tourist_data.phone').matches(/^\+[1-9]\d{7,14}$/).withMessage('Phone must include country code, e.g. +5355512345'),
  body('tourist_data.language').optional().isIn(['es', 'en', 'fr']).withMessage('Invalid language'),
], validate, createBooking);

router.get('/', getMyBookings);
router.get('/host', authorize('host'), getHostBookings);
router.get('/:id', getBookingById);
router.post('/:id/cancel', cancelBooking);
router.post('/:id/complete', authorize('host', 'admin'), completeBooking);

router.post('/:id/approve', authorize('admin'), approveBooking);
router.post('/:id/reject', authorize('admin'), rejectBooking);

module.exports = router;
