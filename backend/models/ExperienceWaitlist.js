const mongoose = require('mongoose');

const experienceWaitlistSchema = new mongoose.Schema({
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
  num_spots_requested: {
    type: Number,
    default: 1,
  },
  position: {
    type: Number,
    required: true,
  },
  notified_at: Date,
  // Ventana dinamica: min(2h, tiempo_restante_hasta_la_excursion / 2). Si
  // falta menos de 1h para la excursion, queda null -- no se promueve
  // automatico (ver computeClaimWindowMs en jobs/holdExpiry.js).
  claim_expires_at: Date,
  status: {
    type: String,
    enum: ['waiting', 'notified', 'claimed', 'expired'],
    default: 'waiting',
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

experienceWaitlistSchema.index({ tenant_id: 1, experience_id: 1, position: 1 });

module.exports = mongoose.model('ExperienceWaitlist', experienceWaitlistSchema);
