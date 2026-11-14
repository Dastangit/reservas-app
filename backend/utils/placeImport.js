// Importa de OpenStreetMap los lugares de interes alrededor de un anuncio.
// No hay lista de ciudades: cuando se aprueba un alojamiento o una excursion
// en una zona sin lugares, se importa un circulo de 2 km. Asi la plataforma
// funciona en cualquier pais desde el primer anuncio.
const Place = require('../models/Place');
const PlaceArea = require('../models/PlaceArea');
const { fetchPlaces } = require('./overpass');
const { isValidPoint } = require('./geo');

const AREA_RADIUS_M = 2000;
// Radio de "lugares cerca" en la ficha (controllers/placeController.js).
const NEAR_RADIUS_M = 1000;
// Un anuncio a menos de 1 km del centro de una zona ya importada tiene sus
// lugares cercanos (1 km a la redonda) dentro de esa zona.
const COVERED_WITHIN_M = AREA_RADIUS_M - NEAR_RADIUS_M;
const EARTH_RADIUS_M = 6378100;

const withinSphere = (point, meters) => ({
  $geoWithin: { $centerSphere: [point.coordinates, meters / EARTH_RADIUS_M] },
});

const OSM_FIELDS = ['name', 'type', 'geo', 'opening_hours'];

async function importArea(area) {
  try {
    const found = await fetchPlaces(area.center, area.radius_m);
    // Lo que el admin corrigio a mano se queda como lo dejo.
    const edited = new Set((await Place.find({
      tenant_id: area.tenant_id,
      osm_id: { $in: found.map((p) => p.osm_id) },
      admin_edited: true,
    }).select('osm_id').lean()).map((p) => p.osm_id));

    const ops = found.filter((p) => !edited.has(p.osm_id)).map((p) => {
      // Un dato que ya no esta en OpenStreetMap (p. ej. el horario) se borra
      // en vez de quedarse con el viejo.
      const $set = { source: 'osm' };
      const $unset = {};
      for (const field of OSM_FIELDS) {
        if (p[field] === undefined) $unset[field] = '';
        else $set[field] = p[field];
      }
      return {
        updateOne: {
          filter: { tenant_id: area.tenant_id, osm_id: p.osm_id },
          update: {
            $set,
            ...(Object.keys($unset).length ? { $unset } : {}),
            $setOnInsert: {
              tenant_id: area.tenant_id, city: area.city, country: area.country, hidden: false,
            },
          },
          upsert: true,
        },
      };
    });
    if (ops.length) await Place.bulkWrite(ops, { ordered: false });

    await PlaceArea.updateOne({ _id: area._id }, {
      $set: { status: 'done', imported_at: new Date(), places_count: found.length },
      $unset: { last_error: '' },
      $inc: { attempts: 1 },
    });
    return found.length;
  } catch (error) {
    console.error('[Places] Importacion fallida:', error.message);
    await PlaceArea.updateOne({ _id: area._id }, {
      $set: { status: 'failed', last_error: String(error.message).slice(0, 300) },
      $inc: { attempts: 1 },
    }).catch(() => {});
    return null;
  }
}

// Zona importada (o en curso) que cubre los alrededores de `point`, o null.
// Si hay varias, la primera creada (ver ensurePlacesAround). Una zona fallida
// tambien cuenta: el cron la reintenta (jobs/placeImport.js), y asi un fallo
// de OpenStreetMap no dispara una consulta nueva en cada visita.
const findCoveringArea = (tenantId, point) => PlaceArea.findOne({
  tenant_id: tenantId,
  center: withinSphere(point, COVERED_WITHIN_M),
}).sort({ created_at: 1, _id: 1 });

// `point` se guarda como centro de la zona: para un alojamiento hay que pasar
// `location.approx`, NUNCA `location.geo` (el punto exacto es privado hasta
// aprobar la reserva). En una excursion vale `location.geo` (es publico).
// Se asegura de que los alrededores de `point` esten importados. Si la zona es
// nueva, la importa (sin esperar, salvo con `wait`). Nunca lanza: un fallo de
// OpenStreetMap no debe romper la aprobacion de un anuncio.
async function ensurePlacesAround(tenantId, point, { city, country, wait = false } = {}) {
  try {
    if (!tenantId || !isValidPoint(point)) return null;
    const existing = await findCoveringArea(tenantId, point);
    if (existing) return existing;
    const area = await PlaceArea.create({
      tenant_id: tenantId, center: point, radius_m: AREA_RADIUS_M, city, country,
    });
    // Dos aprobaciones a la vez en la misma zona crean dos: gana la primera y
    // la otra se borra sin consultar Overpass.
    const first = await findCoveringArea(tenantId, point);
    if (first && !first._id.equals(area._id)) {
      await PlaceArea.deleteOne({ _id: area._id });
      return first;
    }
    const run = importArea(area);
    if (wait) await run;
    return area;
  } catch (error) {
    console.error('[Places] No se pudo preparar la zona:', error.message);
    return null;
  }
}

module.exports = {
  ensurePlacesAround, importArea, findCoveringArea, withinSphere, AREA_RADIUS_M, NEAR_RADIUS_M,
};
