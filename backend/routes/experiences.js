const express = require('express');
const { body } = require('express-validator');
const {
  getExperiences, getExperienceById, createExperienceBooking, joinWaitlist,
  claimWaitlistSpot,
} = require('../controllers/experienceController');
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(setTenant);

// Públicas
router.get('/', getExperiences);
router.get('/:id', getExperienceById);

// Turista (autenticado)
router.post('/:id/book', protect, authorize('tourist'), [
  body('payment_info').isArray({ min: 1 }).withMessage('payment_info is required'),
  body('tourist_data.phone').matches(/^\+[1-9]\d{7,14}$/).withMessage('Phone must include country code, e.g. +5355512345'),
  body('tourist_data.language').optional().isIn(['es', 'en', 'fr']).withMessage('Invalid language'),
], validate, createExperienceBooking);

router.post('/:id/waitlist', protect, authorize('tourist'), joinWaitlist);

router.post('/:id/waitlist/:waitlistId/claim', protect, authorize('tourist'), [
  body('payment_info').isArray({ min: 1 }).withMessage('payment_info is required'),
  body('tourist_data.phone').matches(/^\+[1-9]\d{7,14}$/).withMessage('Phone must include country code, e.g. +5355512345'),
], validate, claimWaitlistSpot);

module.exports = router;
