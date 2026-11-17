const HeroPhoto = require('../models/HeroPhoto');
const Property = require('../models/Property');
const Experience = require('../models/Experience');
const { logAdminAction } = require('../utils/auditLog');

const MODELS = { Property, Experience };
// Fotos que se ofrecen al admin por ciudad (las primeras de sus anuncios).
const MAX_PHOTOS_PER_CITY = 24;
// Tope de anuncios que se leen para armar la lista.
const SCAN_LIMIT = 500;

// Solo anuncios que el turista puede reservar hoy: nunca se muestra en la
// portada un lugar al que la plataforma no pueda llevarlo.
const activeFilter = (type) => (type === 'Property'
  ? { status: 'active', suspended: { $ne: true } }
  : { status: 'active', date: { $gte: new Date() } });

const cleanCity = (city) => String(city || '').trim();
const cityKey = (country, city) => `${country || ''}|${city}`;
const listingName = (type, doc) => (type === 'Property' ? doc.name : doc.title);

// Fotos elegidas, cada una con `valid`: su anuncio sigue activo y la foto
// sigue en el. Las que no valen no salen en la portada.
async function heroPhotosWithStatus(tenantId) {
  const chosen = await HeroPhoto.find({ tenant_id: tenantId }).lean();
  const ids = { Property: [], Experience: [] };
  chosen.forEach((h) => ids[h.source_type].push(h.source_id));

  const urlsById = new Map();
  await Promise.all(Object.entries(ids).map(async ([type, list]) => {
    if (list.length === 0) return;
    const docs = await MODELS[type]
      .find({ _id: { $in: list }, tenant_id: tenantId, ...activeFilter(type) })
      .select('images')
      .lean();
    docs.forEach((d) => urlsById.set(String(d._id), new Set((d.images || []).map((i) => i.url))));
  }));

  return chosen.map((h) => ({ ...h, valid: urlsById.get(String(h.source_id))?.has(h.url) === true }));
}

exports.heroPhotosWithStatus = heroPhotosWithStatus;

// GET /api/admin/hero-photos — ciudades con anuncios activos, las fotos que
// se pueden elegir en cada una y la elegida (si hay).
exports.getHeroPhotoOptions = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const withImages = { 'images.0': { $exists: true } };
    const [properties, experiences, chosen] = await Promise.all([
      Property.find({ tenant_id: tenantId, ...activeFilter('Property'), ...withImages })
        .select('name location.city location.country images').sort({ created_at: -1 }).limit(SCAN_LIMIT).lean(),
      Experience.find({ tenant_id: tenantId, ...activeFilter('Experience'), ...withImages })
        .select('title location.city location.country images').sort({ date: 1 }).limit(SCAN_LIMIT).lean(),
      heroPhotosWithStatus(tenantId),
    ]);

    const cities = new Map();
    const entryFor = (country, city) => {
      const key = cityKey(country, city);
      if (!cities.has(key)) cities.set(key, { city, country: country || '', photos: [], chosen: null });
      return cities.get(key);
    };

    const addListing = (type, doc) => {
      const city = cleanCity(doc.location?.city);
      if (!city) return;
      const entry = entryFor(doc.location?.country, city);
      (doc.images || []).forEach((img) => {
        // Las excursiones repetidas comparten fotos: cada una se ofrece una vez.
        if (!img.url || entry.photos.length >= MAX_PHOTOS_PER_CITY || entry.photos.some((p) => p.url === img.url)) return;
        entry.photos.push({ source_type: type, source_id: doc._id, name: listingName(type, doc), url: img.url });
      });
    };
    properties.forEach((p) => addListing('Property', p));
    experiences.forEach((e) => addListing('Experience', e));

    // Tambien las elegidas cuyo anuncio ya no esta activo, para poder quitarlas.
    chosen.forEach((h) => {
      entryFor(h.country, h.city).chosen = {
        id: h._id, url: h.url, source_type: h.source_type, source_id: h.source_id, valid: h.valid,
      };
    });

    const list = Array.from(cities.values())
      .sort((a, b) => a.city.localeCompare(b.city) || a.country.localeCompare(b.country));

    res.json({ success: true, data: { cities: list } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/hero-photos — elegir la foto de una ciudad. La ciudad sale
// del anuncio; la foto tiene que ser una de las suyas.
exports.setHeroPhoto = async (req, res, next) => {
  try {
    const { source_type: sourceType, source_id: sourceId, url } = req.body;
    const listing = await MODELS[sourceType]
      .findOne({ _id: sourceId, tenant_id: req.tenantId, ...activeFilter(sourceType) })
      .select('location images')
      .lean();
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found or not active' });
    }
    if (!(listing.images || []).some((img) => img.url === url)) {
      return res.status(400).json({ success: false, error: 'That photo is not in the listing' });
    }
    const city = cleanCity(listing.location?.city);
    if (!city) {
      return res.status(400).json({ success: false, error: 'The listing has no city' });
    }

    const heroPhoto = await HeroPhoto.findOneAndUpdate(
      { tenant_id: req.tenantId, country: listing.location?.country || '', city },
      { $set: { source_type: sourceType, source_id: listing._id, url, chosen_by: req.user._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    res.json({ success: true, data: { hero_photo: heroPhoto } });
    logAdminAction({
      tenant_id: req.tenantId, admin_id: req.user._id, action: 'set_hero_photo', target_type: 'HeroPhoto', target_id: heroPhoto._id,
      metadata: { city, country: heroPhoto.country, source_type: sourceType, source_id: listing._id },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/hero-photos/:id — la ciudad deja de salir en la portada.
exports.removeHeroPhoto = async (req, res, next) => {
  try {
    const heroPhoto = await HeroPhoto.findOneAndDelete({ _id: req.params.id, tenant_id: req.tenantId });
    if (!heroPhoto) {
      return res.status(404).json({ success: false, error: 'Hero photo not found' });
    }
    res.json({ success: true, data: { hero_photo_id: heroPhoto._id } });
    logAdminAction({
      tenant_id: req.tenantId, admin_id: req.user._id, action: 'remove_hero_photo', target_type: 'HeroPhoto', target_id: heroPhoto._id,
      metadata: { city: heroPhoto.city, country: heroPhoto.country },
    });
  } catch (error) {
    next(error);
  }
};
