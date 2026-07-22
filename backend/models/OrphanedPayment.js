const mongoose = require('mongoose');

// Registra los IPN de NOWPayments que llegaron sin order_id v\u00e1lido, o con un
// order_id que no corresponde a ninguna reserva existente (reserva borrada,
// IPN corrupto, ataque de IPN falso, etc.). Antes se descartaban en silencio;
// esto les da un lugar donde el admin pueda revisarlos manualmente.
const orphanedPaymentSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
  },
  invoice_id: String,
  payment_id: String,
  order_id: String,
  payment_status: String,
  price_amount: Number,
  price_currency: String,
  actually_paid: Number,
  pay_currency: String,
  reason: {
    type: String,
    enum: ['missing_order_id', 'booking_not_found'],
    required: true,
  },
  raw_payload: {
    type: mongoose.Schema.Types.Mixed,
  },
  reviewed: {
    type: Boolean,
    default: false,
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewed_at: Date,
  resolution_notes: String,
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

orphanedPaymentSchema.index({ reviewed: 1, created_at: -1 });

module.exports = mongoose.model('OrphanedPayment', orphanedPaymentSchema);
