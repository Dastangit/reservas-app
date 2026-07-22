const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  booking_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  },
  message: {
    type: String,
    required: [true, 'Feedback message is required'],
  },
  category: {
    type: String,
    enum: ['ux', 'payment', 'communication', 'features', 'other'],
    default: 'other',
  },
  admin_response: String,
  admin_response_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  admin_response_at: Date,
  status: {
    type: String,
    enum: ['new', 'read', 'responded', 'archived'],
    default: 'new',
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

module.exports = mongoose.model('Feedback', feedbackSchema);
