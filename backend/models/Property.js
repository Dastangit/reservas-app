const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  host_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Property name is required'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['casa_particular', 'hostel'],
    required: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
  },
  location: {
    city: { type: String, required: true },
    neighborhood: String,
    address: String,
    latitude: Number,
    longitude: Number,
  },
  max_guests: {
    type: Number,
    required: true,
    min: 1,
  },
  bedrooms: {
    type: Number,
    default: 1,
  },
  bathrooms: {
    type: Number,
    default: 1,
  },
  bed_types: [String],
  price_per_night: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  amenities: [String],
  images: [{
    url: String,
    title: String,
    order: Number,
    is_primary: { type: Boolean, default: false },
  }],
  blocked_dates: [{
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    reason: String,
    blocked_by: {
      type: String,
      enum: ['host', 'admin'],
      default: 'host',
    },
    blocked_by_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    created_at: { type: Date, default: Date.now },
  }],
  payment_options: {
    type: [String],
    enum: ['full_payment', 'daily_payment'],
    default: ['full_payment'],
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  reviews_count: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending_approval', 'active', 'inactive', 'rejected'],
    default: 'pending_approval',
  },
  approval_date: Date,
  rejection_reason: String,
  admin_notes: String,
  suspended: {
    type: Boolean,
    default: false,
  },
  suspension_reason: String,
  suspended_at: Date,
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

propertySchema.index({ tenant_id: 1, status: 1, suspended: 1, 'location.city': 1 });
propertySchema.index({ tenant_id: 1, price_per_night: 1 });

module.exports = mongoose.model('Property', propertySchema);
