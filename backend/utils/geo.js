// Puntos geograficos en GeoJSON ({ type: 'Point', coordinates: [lng, lat] }),
// que es lo que MongoDB necesita para el indice 2dsphere y $geoNear.
//
// Una propiedad guarda dos puntos en `location`:
// - `geo`: el punto exacto. Solo lo ven el dueno, el admin y el turista con la
//   reserva aprobada (igual que `address`).
// - `approx`: el exacto desplazado al azar entre 150 y 300 m; es el publico.
//   Se calcula una sola vez por punto: si cambiara en cada peticion, promediando
//   varias respuestas se encontraria el exacto.
const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: { type: [Number], required: true, default: undefined },
}, { _id: false });

const APPROX_MIN_M = 150;
const APPROX_MAX_M = 300;
const METERS_PER_DEGREE = 111320;

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Acepta { type: 'Point', coordinates: [lng, lat] }; devuelve el punto limpio
// (6 decimales, ~10 cm) o null si no es valido.
function normalizePoint(value) {
  if (!value || typeof value !== 'object' || value.type !== 'Point') return null;
  const coords = value.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords.map((c) => (typeof c === 'number' ? c : Number.NaN));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return { type: 'Point', coordinates: [round6(lng), round6(lat)] };
}

const isValidPoint = (value) => Boolean(normalizePoint(value));

const samePoint = (a, b) => Boolean(a && b)
  && a.coordinates?.[0] === b.coordinates?.[0] && a.coordinates?.[1] === b.coordinates?.[1];

// Distancia en metros entre dos puntos (haversine).
function distanceMeters(a, b) {
  const [lng1, lat1] = a.coordinates;
  const [lng2, lat2] = b.coordinates;
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

// El punto desplazado al azar entre 150 y 300 m en cualquier direccion.
function approximatePoint(point, random = Math.random) {
  const [lng, lat] = point.coordinates;
  const distance = APPROX_MIN_M + random() * (APPROX_MAX_M - APPROX_MIN_M);
  const bearing = random() * 2 * Math.PI;
  const dLat = (distance * Math.cos(bearing)) / METERS_PER_DEGREE;
  // Cerca de los polos el grado de longitud mide casi 0 m: se acota el divisor.
  const dLng = (distance * Math.sin(bearing))
    / (METERS_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  let newLng = lng + dLng;
  if (newLng > 180) newLng -= 360;
  if (newLng < -180) newLng += 360;
  return { type: 'Point', coordinates: [round6(newLng), round6(Math.max(-90, Math.min(90, lat + dLat)))] };
}

// Prepara `location` para guardar a partir de lo que envia el cliente y lo
// guardado. Si el cliente no manda `geo`, se conserva el actual. `approx` nunca
// lo decide el cliente: se mantiene si el punto no cambio y si no se recalcula.
// Los antiguos latitude/longitude se descartan.
function prepareLocation(incoming, current, { withApprox = false } = {}) {
  if (!incoming || typeof incoming !== 'object') return incoming;
  if (typeof current?.toObject === 'function') current = current.toObject();
  current = current || {};
  const location = { ...incoming };
  delete location.latitude;
  delete location.longitude;
  delete location.approx;
  const geo = location.geo !== undefined ? normalizePoint(location.geo) : (current.geo || null);
  if (geo) location.geo = geo;
  else delete location.geo;
  if (withApprox && geo) {
    location.approx = samePoint(geo, current.geo) && current.approx ? current.approx : approximatePoint(geo);
  }
  return location;
}

module.exports = {
  pointSchema,
  normalizePoint,
  isValidPoint,
  samePoint,
  distanceMeters,
  approximatePoint,
  prepareLocation,
  APPROX_MIN_M,
  APPROX_MAX_M,
};
