const mongoose = require('mongoose');
const { pointSchema } = require('../utils/geo');

// Lugares de interes que se ven en los mapas (paso 3 del plan): museos,
// playas, restaurantes, farmacias, cajeros... Se importan solos de
// OpenStreetMap alrededor de cada anuncio aprobado (utils/placeImport.js) y el
// admin los oculta, corrige o anade desde su panel.
const PLACE_TYPES = [
  'museum', 'monument', 'beach', 'park', 'restaurant', 'cafe', 'bar', 'cinema',
  'barber', 'pharmacy', 'money', 'clinic',
];

const placeSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  name: { type: String, trim: true, maxlength: 200 },
  type: { type: String, enum: PLACE_TYPES, required: true },
  geo: { type: pointSchema, required: true },
  // Horario en el formato de OpenStreetMap ("Mo-Fr 09:00-18:00") o texto libre del admin.
  opening_hours: { type: String, trim: true, maxlength: 300 },
  note: { type: String, trim: true, maxlength: 500 },
  city: { type: String, trim: true },
  country: { type: String, uppercase: true, trim: true },
  hidden: { type: Boolean, default: false },
  source: { type: String, enum: ['osm', 'admin'], default: 'admin' },
  // "node/123", "way/456"... para no duplicar al reimportar.
  osm_id: String,
  // Un lugar de OpenStreetMap que el admin corrigio no se pisa al reimportar.
  admin_edited: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

placeSchema.index({ geo: '2dsphere' });
placeSchema.index({ tenant_id: 1, type: 1, city: 1 });
placeSchema.index(
  { tenant_id: 1, osm_id: 1 },
  { unique: true, partialFilterExpression: { osm_id: { $type: 'string' } } },
);

module.exports = mongoose.model('Place', placeSchema);
module.exports.PLACE_TYPES = PLACE_TYPES;
