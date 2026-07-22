const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  property_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  tourist_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  host_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  check_in: {
    type: Date,
    required: true,
  },
  check_out: {
    type: Date,
    required: true,
  },
  num_nights: {
    type: Number,
    required: true,
  },
  num_guests: {
    type: Number,
    required: true,
  },
  booking_type: {
    type: String,
    enum: ['pre_booking'],
    required: true,
  },
  fee_amount: {
    type: Number,
    default: 7,
  },
  fee_currency: {
    type: String,
    default: 'USD',
  },
  fee_paid: {
    type: Boolean,
    default: false,
  },
  fee_paid_at: Date,
  fee_transaction_id: String,
  total_amount: {
    type: Number,
    required: true,
  },
  payment_option: {
    type: String,
    enum: ['full_payment', 'daily_payment'],
    required: true,
  },
  tourist_data: {
    name: String,
    email: String,
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^\+[1-9]\d{7,14}$/, 'Phone must be in international format, e.g. +5355512345'],
    },
    contact_method: {
      type: String,
      enum: ['whatsapp', 'email'],
    },
    language: {
      type: String,
      enum: ['es', 'en', 'fr'],
      default: 'es',
    },
  },
  hold_expires_at: Date,
  payment_stage: {
    type: String,
    enum: ['awaiting_payment', 'waiting', 'confirming', 'sending', 'partially_paid', 'finished', 'failed', 'expired'],
    default: 'awaiting_payment',
  },
  payment_needs_review: {
    type: Boolean,
    default: false,
  },
  invoice_id: {
    type: String,
  },
  invoice_url: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending_payment', 'pending_approval', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending_payment',
  },
  status_history: [{
    status: String,
    changed_at: Date,
    changed_by: String,
  }],
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approved_at: Date,
  rejection_reason: String,
  admin_notes: String,
  host_notes: String,
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

bookingSchema.index({ tenant_id: 1, status: 1 });
bookingSchema.index({ tourist_id: 1 });
bookingSchema.index({ host_id: 1 });
bookingSchema.index({ property_id: 1, check_in: 1, check_out: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
