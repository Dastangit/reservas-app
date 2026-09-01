const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  invoice_id: {
    type: String,
  },
  // 'qvapay' (default, checkout automatico con webhook) o 'paypal_manual'
  // (link de paypal.me a la cuenta de un tercero fuera de Cuba, confirmado
  // a mano por el admin -- no hay API ni webhook para este metodo).
  method: {
    type: String,
    enum: ['qvapay', 'paypal_manual'],
    default: 'qvapay',
  },
  payment_id: {
    type: String,
  },
  price_amount: {
    type: Number,
    required: true,
  },
  price_currency: {
    type: String,
    default: 'USD',
  },
  pay_amount: {
    type: Number,
  },
  pay_currency: {
    type: String,
  },
  actually_paid: {
    type: Number,
  },
  payment_status: {
    type: String,
    enum: ['waiting', 'confirming', 'confirmed', 'sending', 'finished', 'partially_paid', 'failed', 'expired'],
    default: 'waiting',
  },
  order_id: {
    type: String,
  },
  invoice_url: {
    type: String,
  },
  raw_response: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

paymentSchema.index({ booking_id: 1 });
paymentSchema.index({ invoice_id: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
