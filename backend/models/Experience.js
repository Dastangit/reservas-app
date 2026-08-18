const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
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
  // Si esta instancia fue generada por una plantilla recurrente (ver
  // ExperienceRecurrence.js). null para excursiones de fecha unica.
  recurrence_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExperienceRecurrence',
    default: null,
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
  },
  category: String, // tour, hiking, culinary, class, etc.
  location: {
    city: { type: String, required: true },
    address: String,
    latitude: Number,
    longitude: Number,
  },
  date: {
    type: Date,
    required: true,
  },
  duration_hours: Number,
  max_participants: {
    type: Number,
    required: true,
    min: 1,
  },
  current_participants: {
    type: Number,
    default: 0,
  },
  // Multi-moneda / multi-audiencia. El organizador define tantas
  // combinaciones como necesite (ej: local/CUP, tourist/USD, tourist/USDT).
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
  // Solo true si el organizador certifica tener permiso legal vigente para
  // mezclar clientes locales y turistas en la misma excursion. El admin lo
  // revisa en la aprobacion normal de esta excursion (approveExperience).
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
  status: {
    type: String,
    enum: ['pending_approval', 'active', 'full', 'cancelled', 'completed', 'rejected'],
    default: 'pending_approval',
  },
  rejection_reason: String,
  admin_notes: String,
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

experienceSchema.index({ tenant_id: 1, status: 1, date: 1, 'location.city': 1 });
experienceSchema.index({ recurrence_id: 1, date: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Experience', experienceSchema);
