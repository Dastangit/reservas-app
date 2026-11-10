// MapLibre GL JS (copiado en /vendor, sin CDN) con las teselas gratis de
// OpenFreeMap. Se usa la compilacion para CSP: `script-src 'self'` no admite
// codigo inyectado y `worker-src 'self'` no admite blob:, asi que el worker va
// en su propio archivo. Pesa ~1 MB: solo se descarga cuando una pagina lo pide.
const BASE = '/vendor/maplibre-gl/';
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

let loading = null;

export function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `${BASE}maplibre-gl.css`;
      document.head.appendChild(css);

      const script = document.createElement('script');
      script.src = `${BASE}maplibre-gl-csp.js`;
      script.onload = () => {
        window.maplibregl.setWorkerUrl(`${BASE}maplibre-gl-csp-worker.js`);
        resolve(window.maplibregl);
      };
      script.onerror = () => {
        loading = null;
        script.remove();
        reject(new Error('MapLibre could not be loaded'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

// [lng, lat] <-> GeoJSON Point
export const toPoint = (lng, lat) => ({
  type: 'Point',
  coordinates: [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6],
});

export const isPoint = (p) => p?.type === 'Point'
  && Array.isArray(p.coordinates) && p.coordinates.length === 2
  && p.coordinates.every(Number.isFinite);

// Enlace "Como llegar" que abre la app de mapas del telefono: geo: en Android
// (Google Maps, OsmAnd, Maps.me...), Apple Maps en iPhone y OpenStreetMap en
// el ordenador. No depende de Google, que no funciona en todos los paises.
export function directionsUrl(point) {
  const [lng, lat] = point.coordinates;
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return `geo:${lat},${lng}?q=${lat},${lng}`;
  if (/iPhone|iPad|iPod/i.test(ua)) return `https://maps.apple.com/?daddr=${lat},${lng}`;
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=17/${lat}/${lng}`;
}

// Radio del circulo de la zona: la zona aproximada (`approx`) queda a 150-300 m
// del punto exacto (backend/utils/geo.js), asi que la casa siempre cae dentro.
export const AREA_RADIUS_M = 300;

// Poligono que aproxima un circulo de `radius` metros alrededor de `point`.
function circlePolygon(point, radius, steps = 64) {
  const [lng, lat] = point.coordinates;
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const ring = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
}

// Mapa de solo lectura con la zona aproximada de un alojamiento: un circulo,
// nunca un marcador (el punto exacto no se publica).
export async function showAreaMap(container, point) {
  const maplibregl = await loadMapLibre();
  const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim();
  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center: point.coordinates,
    zoom: 14.5,
    cooperativeGestures: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
  map.on('load', () => {
    map.addSource('area', { type: 'geojson', data: circlePolygon(point, AREA_RADIUS_M) });
    map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': color, 'fill-opacity': 0.18 } });
    map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': color, 'line-width': 2 } });
  });
  return map;
}
