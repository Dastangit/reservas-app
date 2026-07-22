const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  booking_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
  property_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  reviewer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reviewer_role: {
    type: String,
    enum: ['tourist', 'host'],
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  text: {
    type: String,
    required: true,
  },
  submitted_at: {
    type: Date,
    default: Date.now,
  },
  pair_review_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
  },
  both_submitted: {
    type: Boolean,
    default: false,
  },
  revealed_at: Date,
  status: {
    type: String,
    enum: ['draft', 'submitted', 'visible', 'hidden'],
    default: 'submitted',
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

reviewSchema.index({ property_id: 1, status: 1 });
reviewSchema.index({ booking_id: 1 });

module.exports = mongoose.model('Review', reviewSchema);
