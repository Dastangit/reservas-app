const express = require('express');
const { body } = require('express-validator');
const { submitReview, getPropertyReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(setTenant);

router.get('/property/:id', getPropertyReviews);

router.post('/', protect, [
  body('booking_id').notEmpty().withMessage('Booking ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('text').notEmpty().withMessage('Review text is required'),
], validate, submitReview);

module.exports = router;
