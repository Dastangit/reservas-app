const mongoose = require('mongoose');

const experienceBookingSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  experience_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experience',
    required: true,
  },
  tourist_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organizer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Total de cupos reservados -- debe igualar la suma de payment_info[].num_spots
  num_spots: {
    type: Number,
    required: true,
    min: 1,
  },
  // Registro de lo que el organizador va a cobrar directo al cliente -- NO
  // es un pago que pase por la plataforma. Es un array porque una reserva
  // puede mezclar audiencias si la excursion lo permite
  // (Experience.allows_mixed_audience === true); si no lo permite, el
  // controller valida que este array tenga una sola entrada.
  payment_info: [{
    audience: {
      type: String,
      enum: ['local', 'tourist'],
      required: true,
    },
    currency: {
      type: String,
      enum: ['CUP', 'USD', 'USDT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true, // monto total de este tramo
    },
    num_spots: {
      type: Number,
      required: true,
      min: 1,
    },
  }],
  // Sin uso en v1 -- no hay fee de reserva de plataforma para excursiones
  // (se decidio no cobrar dos veces al cliente). Se dejan estos campos por
  // si a futuro se activa un fee en excursiones puntuales de alta demanda.
  fee_amount: Number,
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
  // Plazo para que el admin apruebe -- NO es un plazo de pago (no hay pago
  // de por medio). Si se vence sin aprobacion, se libera el cupo
  // automaticamente via holdExpiry.js. = created_at + 24h.
  hold_expires_at: Date,
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected', 'expired', 'completed', 'cancelled'],
    default: 'pending_approval',
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
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

experienceBookingSchema.index({ tenant_id: 1, status: 1 });
experienceBookingSchema.index({ experience_id: 1 });
experienceBookingSchema.index({ organizer_id: 1 });
experienceBookingSchema.index({ status: 1, hold_expires_at: 1 });

module.exports = mongoose.model('ExperienceBooking', experienceBookingSchema);
