import api from '../api.js';
import i18n from '../i18n.js';
import { escapeHtml } from './escape.js';
import { loadMapLibre, MAP_STYLE, toPoint, isPoint } from './map.js';

const t = (key) => i18n.t(key);

// Selector del punto exacto en el mapa para anfitriones y organizadores:
// buscador de direcciones (Nominatim a traves del backend), boton "Estoy
// aqui" con la ubicacion del navegador y un marcador que se arrastra.
// `kind` es 'property' (el punto no se publica) o 'meeting' (punto de
// encuentro de una excursion, que si es publico).
export const locationPickerHtml = ({ kind = 'property' } = {}) => `
  <div class="form-group location-picker" id="location-picker" data-kind="${kind}">
    <label for="loc-search">${t(`locationPicker.${kind}.label`)}</label>
    <p class="field-hint">${t(`locationPicker.${kind}.hint`)}</p>
    <div class="location-picker-search">
      <input type="search" id="loc-search" autocomplete="off" placeholder="${t('locationPicker.searchPlaceholder')}">
      <button type="button" class="btn btn-secondary" id="loc-search-btn">${t('locationPicker.search')}</button>
      <button type="button" class="btn btn-secondary" id="loc-here">${t(`locationPicker.${kind}.here`)}</button>
    </div>
    <ul class="location-picker-results" id="loc-results" hidden></ul>
    <div class="location-picker-map" id="loc-map" role="application" aria-label="${t('locationPicker.mapLabel')}"></div>
    <p class="location-picker-status" id="loc-status" aria-live="polite"></p>
  </div>
`;

// `initial`: punto ya guardado (al editar). `fill(result)`: rellena ciudad,
// barrio, pais y direccion con lo encontrado si estan vacios. `getCountry()`:
// pais elegido en el formulario, para buscar solo ahi.
export function bindLocationPicker({ initial, fill, getCountry } = {}) {
  const root = document.getElementById('location-picker');
  if (!root) return null;
  const kind = root.dataset.kind;
  const status = root.querySelector('#loc-status');
  const results = root.querySelector('#loc-results');
  const search = root.querySelector('#loc-search');
  let point = isPoint(initial) ? initial : null;
  let map = null;
  let marker = null;

  const setStatus = (text, isError = false) => {
    status.textContent = text;
    status.classList.toggle('error', isError);
  };
  const showPoint = () => {
    if (!point) return setStatus(t(`locationPicker.${kind}.noPoint`));
    const [lng, lat] = point.coordinates;
    setStatus(`${t('locationPicker.pointSet')} (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
  };

  const place = (lng, lat, { fly = true } = {}) => {
    point = toPoint(lng, lat);
    root.classList.remove('invalid');
    if (map) {
      if (!marker) {
        const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim();
        marker = new window.maplibregl.Marker({ draggable: true, ...(color && { color }) })
          .setLngLat([lng, lat]).addTo(map);
        marker.on('dragend', () => {
          const p = marker.getLngLat();
          place(p.lng, p.lat, { fly: false });
        });
      } else {
        marker.setLngLat([lng, lat]);
      }
      if (fly) map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 17) });
    }
    showPoint();
  };

  loadMapLibre().then((maplibregl) => {
    map = new maplibregl.Map({
      container: root.querySelector('#loc-map'),
      style: MAP_STYLE,
      center: point ? point.coordinates : [0, 20],
      zoom: point ? 17 : 1.5,
      cooperativeGestures: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    map.on('click', (e) => place(e.lngLat.lng, e.lngLat.lat, { fly: false }));
    if (point) place(...point.coordinates, { fly: false });
  }).catch(() => setStatus(t('locationPicker.mapFailed'), true));

  const runSearch = async () => {
    const q = search.value.trim();
    if (q.length < 3) return setStatus(t('locationPicker.searchTooShort'), true);
    setStatus(t('locationPicker.searching'));
    const params = new URLSearchParams({ q, lang: i18n.currentLang || 'en' });
    const country = getCountry?.();
    if (country) params.set('country', country);
    try {
      const res = await api.get(`/geo/search?${params}`);
      const list = res.data?.results || [];
      results.innerHTML = list.map((r, i) => `
        <li><button type="button" data-index="${i}">${escapeHtml(r.label)}</button></li>`).join('');
      results.hidden = list.length === 0;
      results.onclick = (e) => {
        const btn = e.target.closest('button[data-index]');
        if (!btn) return;
        const r = list[Number(btn.dataset.index)];
        results.hidden = true;
        place(...r.geo.coordinates);
        fill?.(r);
        setStatus(`${t(`locationPicker.${kind}.adjust`)}`);
      };
      if (list.length === 0) setStatus(t('locationPicker.noResults'), true);
      else setStatus(t('locationPicker.pickResult'));
    } catch (error) {
      setStatus(error.message || t('locationPicker.searchFailed'), true);
    }
  };

  root.querySelector('#loc-search-btn').addEventListener('click', runSearch);
  // Enter en el buscador busca, no envia el formulario.
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  });

  root.querySelector('#loc-here').addEventListener('click', () => {
    if (!navigator.geolocation) return setStatus(t('locationPicker.geoUnavailable'), true);
    setStatus(t('locationPicker.locating'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        place(pos.coords.longitude, pos.coords.latitude);
        setStatus(`${t(`locationPicker.${kind}.adjust`)}`);
      },
      () => setStatus(t('locationPicker.geoDenied'), true),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

  showPoint();

  return {
    // El punto elegido, o null (marca el selector como invalido).
    getPoint() {
      if (!point) {
        root.classList.add('invalid');
        setStatus(t(`locationPicker.${kind}.required`), true);
        root.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return point;
    },
  };
}

// Rellena con lo encontrado los campos de ubicacion que siguen vacios (nunca
// pisa lo que el anfitrion ya escribio). `ids`: id del campo de cada dato.
export function fillEmptyFields(result, ids = {}) {
  const map = { address: 'address', neighborhood: 'neighborhood', city: 'city', country: 'country', ...ids };
  Object.entries(map).forEach(([key, id]) => {
    const el = id && document.getElementById(id);
    if (!el || el.value || !result[key]) return;
    el.value = result[key];
    // Un <select> sin esa opcion queda vacio: se deja como estaba.
    if (el.value !== result[key]) el.value = '';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
