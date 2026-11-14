import api from '../api.js';
import i18n from '../i18n.js';
import { escapeHtml } from './escape.js';
import { addPlacesToMap } from './map.js';

const t = (key) => i18n.t(key);

export const placeTypeLabel = (type) => t(`places.types.${type}`);

// "≈ 400 m · 5 min a pie" (o "≈ 1.3 km" pasado el kilometro). El backend ya
// la redondea y la mide desde la zona aproximada, nunca desde la casa.
export function walkText(place) {
  const distance = place.walk_m >= 1000
    ? `${(place.walk_m / 1000).toLocaleString(i18n.currentLang, { maximumFractionDigits: 1 })} km`
    : `${place.walk_m} m`;
  return t('places.walk').replace('{distance}', distance).replace('{min}', place.walk_min);
}

const placeName = (place) => place.name || placeTypeLabel(place.type);

// Texto de la ventanita del mapa (sin HTML: se pone con textContent).
const mapLabel = (place) => `${placeName(place)} · ${placeTypeLabel(place.type)} · ${walkText(place)}`;

const listHtml = (places) => `
  <ul class="near-places">
    ${places.map((p) => `
      <li>
        <span class="near-places-name">${escapeHtml(placeName(p))}</span>
        <span class="near-places-meta">${escapeHtml(p.name ? `${placeTypeLabel(p.type)} · ` : '')}${escapeHtml(walkText(p))}</span>
        ${p.opening_hours ? `<span class="near-places-hours">${escapeHtml(p.opening_hours)}</span>` : ''}
        ${p.note ? `<span class="near-places-hours">${escapeHtml(p.note)}</span>` : ''}
      </li>`).join('')}
  </ul>
  <p class="field-hint">${t('places.hint')}</p>
`;

// El boton va con los demas del mapa; la lista, debajo del mapa.
export const nearPlacesButtonHtml = () => `
  <button type="button" class="btn btn-outline btn-sm" id="show-near-places">${t('places.show')}</button>
`;
export const nearPlacesListHtml = () => '<div id="near-places" aria-live="polite"></div>';

// Boton "Ver lugares cerca": abre el mapa (si no estaba abierto) con
// `openMap()`, pide los lugares del anuncio y los pone en el mapa y en una
// lista. `query`: "property=<id>" o "experience=<id>".
export function bindNearPlaces({ query, openMap }) {
  const button = document.getElementById('show-near-places');
  const box = document.getElementById('near-places');
  if (!button || !box) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    box.innerHTML = `<p class="loading">${t('common.loading')}</p>`;
    try {
      const [res, map] = await Promise.all([api.get(`/places/near?${query}`), openMap().catch(() => null)]);
      const { places = [], pending, unavailable } = res.data || {};
      if (!places.length) {
        const message = (pending && 'places.pending') || (unavailable && 'places.unavailable') || 'places.none';
        box.innerHTML = `<p class="field-hint">${t(message)}</p>`;
        // Mientras se reunen se puede volver a probar.
        button.disabled = !pending;
        return;
      }
      button.remove();
      box.innerHTML = `<h3>${t('places.title')}</h3>${listHtml(places)}`;
      if (map) addPlacesToMap(map, places, mapLabel);
    } catch (error) {
      button.disabled = false;
      box.innerHTML = `<p class="error">${t('places.loadError')}</p>`;
    }
  });
}
