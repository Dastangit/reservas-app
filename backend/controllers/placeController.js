const mongoose = require('mongoose');
const Place = require('../models/Place');
const PlaceArea = require('../models/PlaceArea');
const Property = require('../models/Property');
const Experience = require('../models/Experience');
const { PLACE_TYPES } = require('../models/Place');
const {
  ensurePlacesAround, findCoveringArea, importArea, NEAR_RADIUS_M,
} = require('../utils/placeImport');
const { normalizePoint } = require('../utils/geo');
const { normalizeCountry } = require('../utils/countries');
const { parsePagination, escapeRegex } = require('../utils/helpers');
const { logAdminAction } = require('../utils/auditLog');

// Los mas cercanos de cada tipo: en el centro de una ciudad los restaurantes
// llenarian la lista y no se verian el museo, la farmacia o el cajero.
const NEAR_PER_TYPE = 6;
// Tope de lo que se lee de la base antes de repartir por tipo.
const NEAR_SCAN_LIMIT = 500;
// Camino a pie = linea recta x 1.3 (como el respaldo de Up), a 80 m por minuto.
const WALK_FACTOR = 1.3;
const WALK_M_PER_MIN = 80;

// "≈ 400 m · 5 min a pie": redondeado a 50 m (100 m pasado el kilometro), para
// no dar distancias precisas.
function walkingDistance(straightMeters) {
  const walk = straightMeters * WALK_FACTOR;
  const step = walk >= 1000 ? 100 : 50;
  return {
    walk_m: Math.max(step, Math.round(walk / step) * step),
    walk_min: Math.max(1, Math.round(walk / WALK_M_PER_MIN)),
  };
}

// El punto desde el que se mide: la zona aproximada del alojamiento (nunca el
// exacto: con varias distancias exactas se triangularia la casa) o el punto de
// encuentro de la excursion, que es publico.
async function findCenter(req) {
  const { property, experience } = req.query;
  if (property) {
    const p = await Property.findOne({
      _id: property, tenant_id: req.tenantId, status: 'active', suspended: { $ne: true },
    }).select('location.approx location.city location.country').lean();
    return p && { point: p.location?.approx, city: p.location?.city, country: p.location?.country };
  }
  const e = await Experience.findOne({ _id: experience, tenant_id: req.tenantId, status: 'active' })
    .select('location.geo location.city location.country').lean();
  return e && { point: e.location?.geo, city: e.location?.city, country: e.location?.country };
}

// GET /api/places/near?property=<id> | ?experience=<id>
// Lugares de interes en 1 km alrededor de un anuncio publicado. Solo por
// anuncio, nunca por coordenadas sueltas: asi nadie puede usar la plataforma
// para importar zonas arbitrarias de OpenStreetMap.
exports.getNearPlaces = async (req, res, next) => {
  try {
    const center = await findCenter(req);
    const point = normalizePoint(center?.point);
    if (!point) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    // Normalmente la zona se importo al aprobar el anuncio; si no (anuncios de
    // antes de esta funcion), se pide ahora y el turista vuelve en un momento.
    const area = await findCoveringArea(req.tenantId, point)
      || await ensurePlacesAround(req.tenantId, point, { city: center.city, country: center.country });

    const found = await Place.aggregate([
      {
        $geoNear: {
          near: point,
          key: 'geo',
          distanceField: 'distance',
          maxDistance: NEAR_RADIUS_M,
          spherical: true,
          query: { tenant_id: new mongoose.Types.ObjectId(String(req.tenantId)), hidden: false },
        },
      },
      { $limit: NEAR_SCAN_LIMIT },
      {
        $project: {
          name: 1, type: 1, geo: 1, opening_hours: 1, note: 1, distance: 1,
        },
      },
    ]);

    const perType = {};
    const places = found
      .filter((p) => {
        perType[p.type] = (perType[p.type] || 0) + 1;
        return perType[p.type] <= NEAR_PER_TYPE;
      })
      .map(({ distance, ...place }) => ({ ...place, ...walkingDistance(distance) }));
    // Mientras la zona se importa, o si fallo y espera el reintento del cron,
    // se avisa en vez de decir "no hay nada cerca".
    const status = places.length ? 'done' : area?.status;
    res.json({
      success: true,
      data: { places, pending: status === 'pending', unavailable: status === 'failed' },
    });
  } catch (error) {
    next(error);
  }
};

// --- Panel del admin -------------------------------------------------------

const EDITABLE_FIELDS = ['name', 'type', 'opening_hours', 'note', 'city', 'hidden'];

function pickPlaceFields(body) {
  const data = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
  }
  if (body.country !== undefined) data.country = normalizeCountry(body.country) || undefined;
  if (body.geo !== undefined) data.geo = normalizePoint(body.geo);
  return data;
}

// GET /api/admin/places?q=&type=&city=&country=&hidden=true|false&page=
exports.getPlaces = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const filter = { tenant_id: req.tenantId };
    if (PLACE_TYPES.includes(req.query.type)) filter.type = req.query.type;
    if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q)), 'i');
    if (req.query.city) filter.city = new RegExp(escapeRegex(String(req.query.city)), 'i');
    if (normalizeCountry(req.query.country)) filter.country = normalizeCountry(req.query.country);
    if (req.query.hidden === 'true' || req.query.hidden === 'false') filter.hidden = req.query.hidden === 'true';

    const [places, total, areas] = await Promise.all([
      Place.find(filter).sort({ city: 1, type: 1, name: 1 }).skip(skip).limit(limit).lean(),
      Place.countDocuments(filter),
      PlaceArea.find({ tenant_id: req.tenantId }).sort({ created_at: -1 }).limit(100).lean(),
    ]);
    res.json({
      success: true,
      data: {
        places, areas, total, page, pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/places — un lugar que OpenStreetMap no tiene.
exports.createPlace = async (req, res, next) => {
  try {
    const data = pickPlaceFields(req.body);
    const place = await Place.create({
      ...data, tenant_id: req.tenantId, source: 'admin', admin_edited: true,
    });
    res.status(201).json({ success: true, data: { place } });
    logAdminAction({
      tenant_id: req.tenantId, admin_id: req.user._id, action: 'create_place', target_type: 'Place', target_id: place._id,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/places/:id — corregir u ocultar. Un lugar de OpenStreetMap
// corregido ya no se pisa al reimportar la zona.
exports.updatePlace = async (req, res, next) => {
  try {
    const data = pickPlaceFields(req.body);
    if (data.geo === null) {
      return res.status(400).json({ success: false, error: 'Invalid point' });
    }
    const onlyVisibility = Object.keys(data).every((k) => k === 'hidden');
    const place = await Place.findOneAndUpdate(
      { _id: req.params.id, tenant_id: req.tenantId },
      { $set: { ...data, ...(onlyVisibility ? {} : { admin_edited: true }) } },
      { new: true, runValidators: true },
    );
    if (!place) {
      return res.status(404).json({ success: false, error: 'Place not found' });
    }
    res.json({ success: true, data: { place } });
    logAdminAction({
      tenant_id: req.tenantId, admin_id: req.user._id, action: 'update_place', target_type: 'Place', target_id: place._id,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/places/:id — solo los que anadio el admin: uno de
// OpenStreetMap volveria en la siguiente importacion, asi que se oculta.
exports.deletePlace = async (req, res, next) => {
  try {
    const place = await Place.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (!place) {
      return res.status(404).json({ success: false, error: 'Place not found' });
    }
    if (place.source === 'osm') {
      return res.status(400).json({ success: false, error: 'Places from OpenStreetMap are hidden, not deleted' });
    }
    await place.deleteOne();
    res.json({ success: true, data: { place_id: place._id } });
    logAdminAction({
      tenant_id: req.tenantId, admin_id: req.user._id, action: 'delete_place', target_type: 'Place', target_id: place._id,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/place-areas/:id/import — reimportar una zona ya mismo.
exports.reimportArea = async (req, res, next) => {
  try {
    const area = await PlaceArea.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (!area) {
      return res.status(404).json({ success: false, error: 'Area not found' });
    }
    const count = await importArea(area);
    if (count === null) {
      return res.status(502).json({ success: false, error: 'OpenStreetMap is unavailable right now' });
    }
    res.json({ success: true, data: { area_id: area._id, places_count: count } });
  } catch (error) {
    next(error);
  }
};

exports.walkingDistance = walkingDistance;
