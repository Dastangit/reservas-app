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

// Mapa de solo lectura con un punto publico (el punto de encuentro de una
// excursion): aqui si va un marcador.
export async function showPointMap(container, point) {
  const maplibregl = await loadMapLibre();
  const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim();
  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center: point.coordinates,
    zoom: 15.5,
    cooperativeGestures: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
  new maplibregl.Marker({ ...(color && { color }) }).setLngLat(point.coordinates).addTo(map);
  return map;
}

// Lugares de interes sobre un mapa ya abierto: un circulo por lugar y, al
// tocarlo, su nombre. `label(place)` da el texto (nombre, tipo y distancia).
// El texto va con textContent: los nombres vienen de OpenStreetMap.
export function addPlacesToMap(map, places, label) {
  const style = getComputedStyle(document.documentElement);
  const color = style.getPropertyValue('--cta-fill').trim();
  const ring = style.getPropertyValue('--on-color').trim();
  const data = {
    type: 'FeatureCollection',
    features: places.map((p, i) => ({ type: 'Feature', geometry: p.geo, properties: { i } })),
  };
  const add = () => {
    if (map.getSource('places')) {
      map.getSource('places').setData(data);
      return;
    }
    map.addSource('places', { type: 'geojson', data });
    map.addLayer({
      id: 'places',
      type: 'circle',
      source: 'places',
      paint: {
        'circle-radius': 7, 'circle-color': color, 'circle-stroke-width': 2, 'circle-stroke-color': ring,
      },
    });
    map.on('click', 'places', (e) => {
      const place = places[e.features[0].properties.i];
      const text = document.createElement('span');
      text.textContent = label(place);
      new window.maplibregl.Popup({ closeButton: false, offset: 8 })
        .setLngLat(place.geo.coordinates).setDOMContent(text).addTo(map);
    });
    map.on('mouseenter', 'places', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'places', () => { map.getCanvas().style.cursor = ''; });
  };
  if (map.isStyleLoaded()) add();
  else map.once('load', add);
  if (places.length) {
    const bounds = new window.maplibregl.LngLatBounds();
    places.forEach((p) => bounds.extend(p.geo.coordinates));
    bounds.extend(map.getCenter());
    map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 });
  }
}
