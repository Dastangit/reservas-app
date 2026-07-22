const express = require('express');
const { body } = require('express-validator');
const { submitFeedback, getAllFeedback, respondToFeedback } = require('../controllers/feedbackController');
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(setTenant);

router.post('/', protect, [
  body('message').notEmpty().withMessage('Feedback message is required'),
], validate, submitFeedback);

router.get('/', protect, authorize('admin'), getAllFeedback);
router.post('/:id/respond', protect, authorize('admin'), [
  body('response').notEmpty().withMessage('Response is required'),
], validate, respondToFeedback);

module.exports = router;
