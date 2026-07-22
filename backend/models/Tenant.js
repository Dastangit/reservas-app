const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tenant name is required'],
    trim: true,
  },
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    unique: true,
    lowercase: true,
  },
  admin_email: {
    type: String,
    required: [true, 'Admin email is required'],
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
  },
  admin_phone: String,
  admin_whatsapp: String,
  api_key: String,
  settings: {
    languages: {
      type: [String],
      default: ['en', 'es'],
    },
    default_language: {
      type: String,
      default: 'en',
    },
    currency: {
      type: String,
      default: 'USD',
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    payment: {
      gateway: { type: String, default: 'nowpayments' },
      nowpayments_api_key: String,
      nowpayments_ipn_key: String,
      fee_amount: { type: Number, default: 7 },
      fee_currency: { type: String, default: 'USD' },
    },
    branding: {
      logo_url: String,
      primary_color: { type: String, default: '#2C5F8D' },
      secondary_color: { type: String, default: '#F39C12' },
      favicon_url: String,
    },
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  subscription_tier: {
    type: String,
    enum: ['starter', 'pro', 'enterprise'],
    default: 'starter',
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

module.exports = mongoose.model('Tenant', tenantSchema);
