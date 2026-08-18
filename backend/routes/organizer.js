const express = require('express');
const { body } = require('express-validator');
const {
  createExperience, updateExperience, getMyExperiences,
  getOrganizerExperienceBookings, completeExperienceBooking,
  createRecurrence, updateRecurrence, pauseRecurrence, endRecurrence,
  getRecurrenceOccurrences,
} = require('../controllers/organizerController');
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(setTenant);
router.use(protect);
router.use(authorize('organizer'));

const experienceValidators = [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('location.city').notEmpty().withMessage('City is required'),
  body('max_participants').isInt({ min: 1 }).withMessage('Max participants must be at least 1'),
  body('pricing').isArray({ min: 1 }).withMessage('At least one pricing entry is required'),
];

// Excursiones de fecha única
router.get('/experiences', getMyExperiences);
router.post('/experiences', [
  ...experienceValidators,
  body('date').isISO8601().withMessage('Date is required'),
], validate, createExperience);
router.put('/experiences/:id', updateExperience);

router.get('/experience-bookings', getOrganizerExperienceBookings);
router.post('/experience-bookings/:id/complete', completeExperienceBooking);

// Excursiones recurrentes
router.post('/recurrences', [
  ...experienceValidators,
  body('recurrence.start_date').isISO8601().withMessage('recurrence.start_date is required'),
  body('recurrence.days_of_week').isArray({ min: 1 }).withMessage('recurrence.days_of_week is required'),
], validate, createRecurrence);
router.put('/recurrences/:id', updateRecurrence);
router.post('/recurrences/:id/pause', pauseRecurrence);
router.post('/recurrences/:id/end', endRecurrence);
router.get('/recurrences/:id/occurrences', getRecurrenceOccurrences);

module.exports = router;
