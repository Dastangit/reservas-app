const mongoose = require('mongoose');
const { pointSchema } = require('../utils/geo');
const {
  SERVICE_ITEMS, ITEM_STATUSES, ENERGY_KINDS, SCHEDULE_MODES,
} = require('../utils/propertyServices');

// Tipos de alojamiento. Misma lista en frontend/js/utils/propertyTypes.js.
// Cada anuncio es una unidad que se reserva entera: un hotel u hostal publica
// cada tipo de habitacion como un anuncio aparte.
const PROPERTY_TYPES = [
  'apartment', 'house', 'villa', 'cabin', 'private_room', 'guest_house', 'casa_particular', 'hostel', 'hotel',
];

const scheduleDef = {
  mode: { type: String, enum: SCHEDULE_MODES },
  from: String,
  to: String,
};

// Lo que el anfitrion declara que ofrece (utils/propertyServices.js valida que
// conteste todo al publicar y editar). Tambien se copia en cada reserva.
const servicesSchema = new mongoose.Schema({
  energy_backup: {
    kind: { type: String, enum: ENERGY_KINDS },
    schedule: scheduleDef,
    powers_ac: Boolean,
    note: String,
  },
  air_conditioning: {
    available: Boolean,
    schedule: scheduleDef,
    note: String,
  },
  items: [{
    _id: false,
    key: { type: String, enum: SERVICE_ITEMS },
    status: { type: String, enum: ITEM_STATUSES },
    note: String,
  }],
  house_rules: {
    quiet_hours: { enabled: Boolean, from: String, to: String },
    lights_out: { enabled: Boolean, at: String },
  },
}, { _id: false });

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
    enum: PROPERTY_TYPES,
    required: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
  },
  location: {
    city: { type: String, required: true },
    // ISO 3166-1 alfa-2 ("MX", "CU"). Obligatorio al crear (validado en la ruta).
    country: { type: String, uppercase: true, trim: true, match: /^[A-Z]{2}$/ },
    neighborhood: String,
    // Direccion y punto exactos: solo para el dueno, el admin y el turista con
    // la reserva aprobada. En publico va `approx` (ver utils/geo.js).
    address: String,
    geo: pointSchema,
    approx: pointSchema,
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
  // Otros servicios, en texto libre ("Piscina", "Terraza"...).
  amenities: [String],
  services: servicesSchema,
  images: [{
    url: String,
    public_id: String,
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
  // true cuando el host edita contenido de una propiedad ya aprobada; el
  // admin lo limpia al revisarla (approveProperty).
  changes_pending_review: {
    type: Boolean,
    default: false,
  },
  // Bloqueo corto mientras se crea una reserva o se bloquean fechas (ver
  // utils/propertyLock.js). No es dato de negocio.
  booking_lock_until: {
    type: Date,
    default: null,
    select: false,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

propertySchema.index({ tenant_id: 1, status: 1, suspended: 1, 'location.city': 1 });
propertySchema.index({ tenant_id: 1, price_per_night: 1 });
propertySchema.index({ host_id: 1 });
propertySchema.index({ 'location.geo': '2dsphere' });
propertySchema.index({ 'location.approx': '2dsphere' });

module.exports = mongoose.model('Property', propertySchema);
module.exports.PROPERTY_TYPES = PROPERTY_TYPES;
module.exports.servicesSchema = servicesSchema;
