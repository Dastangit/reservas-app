const mongoose = require('mongoose');

// Foto de la portada para una ciudad, elegida por el admin entre las fotos de
// los anuncios activos de esa ciudad. Una ciudad sale en el carrusel de la home
// solo si tiene una (opt-in): asi una foto rara de un anfitrion (un logo, una
// captura...) nunca llega sola a la portada. Si el anuncio deja de estar activo
// o quita la foto, la ciudad deja de salir hasta que el admin elija otra.
const heroPhotoSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  // Ciudad y pais salen del anuncio, no del cliente.
  city: { type: String, required: true, trim: true },
  country: { type: String, uppercase: true, trim: true },
  source_type: { type: String, enum: ['Property', 'Experience'], required: true },
  source_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  // La foto se identifica por su URL (no todas tienen public_id).
  url: { type: String, required: true },
  chosen_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

heroPhotoSchema.index({ tenant_id: 1, country: 1, city: 1 }, { unique: true });

module.exports = mongoose.model('HeroPhoto', heroPhotoSchema);
