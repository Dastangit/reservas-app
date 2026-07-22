const express = require('express');
const { body } = require('express-validator');
const {
  getProperties, getMyProperties, getPropertyById, createProperty,
  updateProperty, checkAvailability,
  blockDates, unblockDates, getAvailabilityCalendar,
} = require('../controllers/propertyController');
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(setTenant);

router.get('/my', protect, authorize('host'), getMyProperties);
router.get('/', getProperties);
router.get('/:id', getPropertyById);
router.get('/:id/availability', checkAvailability);
router.get('/:id/availability/calendar', getAvailabilityCalendar);

router.post('/', protect, authorize('host'), [
  body('name').notEmpty().withMessage('Name is required'),
  body('type').isIn(['casa_particular', 'hostel']).withMessage('Type must be casa_particular or hostel'),
  body('description').notEmpty().withMessage('Description is required'),
  body('location.city').notEmpty().withMessage('City is required'),
  body('max_guests').isInt({ min: 1 }).withMessage('Max guests must be at least 1'),
  body('price_per_night').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
], validate, createProperty);

router.put('/:id', protect, authorize('host'), updateProperty);
router.post('/:id/availability/block', protect, authorize('host'), [
  body('start_date').notEmpty().withMessage('start_date is required'),
  body('end_date').notEmpty().withMessage('end_date is required'),
], validate, blockDates);
router.delete('/:id/availability/block/:blockId', protect, authorize('host'), unblockDates);

module.exports = router;
