const mongoose = require('mongoose');

// Plantilla de una excursion recurrente. Cada ocurrencia generada es un
// documento Experience normal (ver Experience.js), independiente en cupos,
// estado y aprobacion -- esta plantilla solo define el patron y los datos
// base que se copian a cada nueva instancia. No requiere aprobacion de
// admin a nivel de plantilla: cada ocurrencia se aprueba individualmente.
const experienceRecurrenceSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  organizer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: String,
  location: {
    city: { type: String, required: true },
    address: String,
    latitude: Number,
    longitude: Number,
  },
  duration_hours: Number,
  max_participants: {
    type: Number,
    required: true,
    min: 1,
  },
  pricing: [{
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
      required: true,
      min: 0,
    },
  }],
  allows_mixed_audience: {
    type: Boolean,
    default: false,
  },
  images: [{
    url: String,
    public_id: String,
    order: Number,
    is_primary: { type: Boolean, default: false },
  }],
  includes: [String],
  requirements: [String],
  cancellation_policy: String,
  recurrence: {
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly'],
      default: 'weekly',
    },
    days_of_week: [Number], // 0=domingo ... 6=sabado
    time_of_day: String,    // "09:00", se combina con cada fecha generada
    start_date: {
      type: Date,
      required: true,
    },
    end_date: Date, // null = indefinido
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'ended'],
    default: 'active',
  },
  // Cuantos dias hacia adelante se generan instancias -- limita cuanto en
  // el futuro un turista puede ver/reservar una ocurrencia de esta serie.
  generate_horizon_days: {
    type: Number,
    default: 30,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

module.exports = mongoose.model('ExperienceRecurrence', experienceRecurrenceSchema);
