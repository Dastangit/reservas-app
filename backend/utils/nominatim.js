// Buscador de direcciones con Nominatim (OpenStreetMap, gratis y mundial).
// Se llama solo desde el backend, como pide su politica de uso
// (https://operations.osmfoundation.org/policies/nominatim/):
// - User-Agent que identifica la aplicacion;
// - como maximo 1 peticion por segundo (por proceso);
// - resultados en cache, sin repetir la misma busqueda.
const env = require('../config/env');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const MIN_INTERVAL_MS = 1000;
// Si la cola ya espera mas que esto, se responde "ocupado" en vez de encolar.
const MAX_WAIT_MS = 5000;
const TIMEOUT_MS = 8000;

const cache = new Map();
let nextSlot = 0;

const userAgent = () => `ElysioExperiences/1.0 (+${env.frontendUrl})`;

class GeoBusyError extends Error {}

// Reserva el siguiente hueco libre de 1 s; espera hasta que llegue.
async function takeSlot() {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  if (start - now > MAX_WAIT_MS) throw new GeoBusyError('Address search is busy, try again in a few seconds');
  nextSlot = start + MIN_INTERVAL_MS;
  if (start > now) await new Promise((resolve) => { setTimeout(resolve, start - now); });
}

// Lo que el formulario necesita de cada resultado: el punto y los datos para
// rellenar ciudad, barrio y pais si el anfitrion aun no los puso.
function toResult(item) {
  const a = item.address || {};
  const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(' ');
  return {
    label: item.display_name,
    geo: { type: 'Point', coordinates: [Number(item.lon), Number(item.lat)] },
    address: street || undefined,
    neighborhood: a.neighbourhood || a.suburb || a.quarter || undefined,
    city: a.city || a.town || a.village || a.municipality || a.county || undefined,
    country: a.country_code ? String(a.country_code).toUpperCase() : undefined,
  };
}

function remember(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

async function searchAddress(query, { lang = 'en', country } = {}) {
  const q = String(query || '').trim().replace(/\s+/g, ' ');
  const cc = country ? String(country).toLowerCase() : '';
  const key = `${lang}|${cc}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  await takeSlot();
  const params = new URLSearchParams({
    q, format: 'jsonv2', addressdetails: '1', limit: '5', 'accept-language': lang,
  });
  if (cc) params.set('countrycodes', cc);
  const res = await fetch(`${env.nominatimUrl}/search?${params}`, {
    headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim respondio ${res.status}`);
  const results = (await res.json())
    .map(toResult)
    .filter((r) => r.geo.coordinates.every(Number.isFinite));
  remember(key, results);
  return results;
}

// Solo para pruebas.
function resetForTests() {
  cache.clear();
  nextSlot = 0;
}

module.exports = { searchAddress, GeoBusyError, resetForTests };
