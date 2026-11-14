const mongoose = require('mongoose');
const { pointSchema } = require('../utils/geo');

// Zona ya importada de OpenStreetMap: un circulo de `radius_m` alrededor de
// `center`. Sirve para no repetir la importacion en cada anuncio de la misma
// zona y para reintentar o actualizar las que fallaron o envejecieron
// (jobs/placeImport.js). `center` sale de `location.approx` en los
// alojamientos (ver ensurePlacesAround), nunca del punto exacto.
const placeAreaSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  center: { type: pointSchema, required: true },
  radius_m: { type: Number, required: true },
  city: String,
  country: String,
  status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  last_error: String,
  places_count: { type: Number, default: 0 },
  imported_at: Date,
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

placeAreaSchema.index({ center: '2dsphere' });
placeAreaSchema.index({ status: 1, imported_at: 1 });

module.exports = mongoose.model('PlaceArea', placeAreaSchema);
