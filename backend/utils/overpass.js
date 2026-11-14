// Lugares de interes desde Overpass (OpenStreetMap, gratis y mundial). Se
// llama solo desde el backend, una consulta a la vez y con un User-Agent
// propio, como pide su politica (https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).
// Los datos exigen la atribucion "© OpenStreetMap", que el mapa ya muestra.
const env = require('../config/env');

// El servidor publico a veces tarda mas de un minuto en atender incluso una
// consulta minima (medido el 9-nov: 36-65 s). La importacion va en segundo
// plano, asi que se espera hasta 2 minutos.
const TIMEOUT_MS = 120000;
const SERVER_TIMEOUT_S = 100;
const MIN_INTERVAL_MS = env.overpassMinIntervalMs;
// Tope por tipo: en el centro de una ciudad grande hay cientos de
// restaurantes en 2 km; con unas decenas por tipo basta para el mapa.
const PER_TYPE_LIMIT = 60;

// Tipo de la plataforma -> filtros de OpenStreetMap. El orden decide el tipo
// cuando un lugar cumple varios: monumento va al final porque "attraction" es
// muy amplio (un restaurante famoso tambien lo lleva).
const OSM_FILTERS = {
  museum: ['["tourism"="museum"]'],
  beach: ['["natural"="beach"]'],
  park: ['["leisure"="park"]'],
  restaurant: ['["amenity"="restaurant"]'],
  cafe: ['["amenity"="cafe"]'],
  bar: ['["amenity"~"^(bar|pub)$"]'],
  cinema: ['["amenity"="cinema"]'],
  barber: ['["shop"~"^(hairdresser|barber)$"]'],
  pharmacy: ['["amenity"="pharmacy"]'],
  money: ['["amenity"~"^(bank|atm|bureau_de_change)$"]'],
  clinic: ['["amenity"~"^(clinic|hospital|doctors)$"]'],
  monument: ['["historic"~"^(monument|castle|fort)$"]', '["tourism"="attraction"]'],
};

// Los filtros ya separados en clave y prueba del valor, para clasificar cada resultado.
const PARSED_FILTERS = Object.entries(OSM_FILTERS).map(([type, filters]) => [type, filters.map((f) => {
  const [, key, op, value] = f.match(/^\["([^"]+)"(=|~)"([^"]+)"\]$/);
  const re = new RegExp(value);
  return { key, test: op === '=' ? (v) => v === value : (v) => re.test(v) };
})]);

// Sin nombre no se sabe que es; los cajeros y casas de cambio sueltos si
// sirven (se muestran con el nombre del banco o solo con el tipo).
const UNNAMED_OK = new Set(['money']);

const userAgent = () => `ElysioExperiences/1.0 (+${env.frontendUrl})`;

let queue = Promise.resolve();
let lastRun = 0;

// Una consulta a la vez por proceso, separadas al menos 5 s.
function serialize(task) {
  const run = queue.then(async () => {
    const wait = lastRun + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => { setTimeout(resolve, wait); });
    try {
      return await task();
    } finally {
      lastRun = Date.now();
    }
  });
  queue = run.catch(() => {});
  return run;
}

function buildQuery([lng, lat], radius) {
  const around = `(around:${Math.round(radius)},${lat},${lng})`;
  const blocks = Object.values(OSM_FILTERS).map((filters) => {
    const parts = filters.map((f) => `nwr${f}${around};`).join('');
    return `(${parts});out center tags ${PER_TYPE_LIMIT};`;
  });
  return `[out:json][timeout:${SERVER_TIMEOUT_S}];${blocks.join('')}`;
}

function typeOf(tags) {
  const found = PARSED_FILTERS.find(([, filters]) => filters
    .some(({ key, test }) => tags[key] !== undefined && test(String(tags[key]))));
  return found ? found[0] : null;
}

// El nombre va como en el letrero (`name`), que es lo que el turista ve en la calle.
function toPlace(element) {
  const tags = element.tags || {};
  const type = typeOf(tags);
  if (!type) return null;
  const name = tags.name || tags.brand || tags.operator;
  if (!name && !UNNAMED_OK.has(type)) return null;
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    osm_id: `${element.type}/${element.id}`,
    type,
    name: name ? String(name).slice(0, 200) : undefined,
    geo: { type: 'Point', coordinates: [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] },
    opening_hours: tags.opening_hours ? String(tags.opening_hours).slice(0, 300) : undefined,
  };
}

async function query(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': userAgent(),
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ data }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Overpass respondio ${res.status}`);
  return res.json();
}

// Lugares en `radius` metros alrededor de `point` (GeoJSON). Sin duplicados.
// Si un servidor falla se prueba el siguiente de OVERPASS_URL (separados por comas).
async function fetchPlaces(point, radius) {
  return serialize(async () => {
    const data = buildQuery(point.coordinates, radius);
    const errors = [];
    for (const url of env.overpassUrls) {
      try {
        const { elements = [] } = await query(url, data);
        const seen = new Set();
        return elements
          .map(toPlace)
          .filter((p) => p && !seen.has(p.osm_id) && seen.add(p.osm_id));
      } catch (error) {
        errors.push(`${new URL(url).host}: ${error.message}`);
      }
    }
    throw new Error(errors.join(' | '));
  });
}

// Solo para pruebas.
function resetForTests() {
  queue = Promise.resolve();
  lastRun = 0;
}

module.exports = {
  fetchPlaces, buildQuery, toPlace, OSM_FILTERS, resetForTests,
};
