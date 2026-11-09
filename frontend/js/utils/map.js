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
