import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { escapeHtml } from '../utils/escape.js';
import { countryOptions } from '../utils/places.js';
import { placeTypeLabel } from '../utils/nearPlaces.js';
import { locationPickerHtml, bindLocationPicker, fillEmptyFields } from '../utils/locationPicker.js';

const t = (key) => i18n.t(key);

// Mismos tipos que backend/models/Place.js.
const PLACE_TYPES = [
  'museum', 'monument', 'beach', 'park', 'restaurant', 'cafe', 'bar', 'cinema',
  'barber', 'pharmacy', 'money', 'clinic',
];

const typeOptions = (selected = '') => PLACE_TYPES
  .map((type) => `<option value="${type}" ${type === selected ? 'selected' : ''}>${escapeHtml(placeTypeLabel(type))}</option>`)
  .join('');

const formatDateTime = (value) => (value ? new Date(value).toLocaleString(i18n.currentLang) : '—');

// Lugares de interes de los mapas: se importan solos de OpenStreetMap al
// aprobar anuncios. Aqui el admin los oculta, corrige o anade.
const AdminPlacesPage = {
  currentPage: 1,
  places: [],

  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-places-page">
        <div class="container">
          <h1>${t('adminPlaces.title')}</h1>
          <p class="page-subtitle">${t('adminPlaces.subtitle')}</p>

          <form id="places-filter" class="admin-places-filter">
            <input type="search" id="places-q" placeholder="${t('adminPlaces.searchPlaceholder')}" aria-label="${t('adminPlaces.searchPlaceholder')}">
            <input type="text" id="places-city" placeholder="${t('adminPlaces.city')}" aria-label="${t('adminPlaces.city')}">
            <select id="places-type" aria-label="${t('adminPlaces.type')}">
              <option value="">${t('adminPlaces.allTypes')}</option>
              ${typeOptions()}
            </select>
            <select id="places-hidden" aria-label="${t('adminPlaces.visibility')}">
              <option value="">${t('adminPlaces.allVisibility')}</option>
              <option value="false">${t('adminPlaces.visible')}</option>
              <option value="true">${t('adminPlaces.hiddenPlural')}</option>
            </select>
            <button type="submit" class="btn btn-secondary">${t('adminPlaces.filter')}</button>
            <button type="button" class="btn btn-primary" id="places-add">${t('adminPlaces.add')}</button>
          </form>

          <div id="place-form-box"></div>

          <div id="places-list"><p class="loading">${t('common.loading')}</p></div>
          <div id="places-pagination" class="pagination-controls"></div>

          <h2 class="admin-places-areas-title">${t('adminPlaces.areasTitle')}</h2>
          <p class="field-hint">${t('adminPlaces.areasHint')}</p>
          <div id="areas-list"></div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    document.getElementById('places-filter').addEventListener('submit', (e) => {
      e.preventDefault();
      this.load(1);
    });
    document.getElementById('places-add').addEventListener('click', () => this.showForm());

    window.placesPrevPage = () => this.load(this.currentPage - 1);
    window.placesNextPage = () => this.load(this.currentPage + 1);
    // data-action: recibe data-arg, data-arg2... y `this` es el boton.
    const page = this;
    window.togglePlaceHidden = (placeId, hidden) => this.update(placeId, { hidden: hidden !== 'true' });
    window.editPlace = (placeId) => this.showForm(this.places.find((p) => p._id === placeId));
    window.deletePlace = async (placeId) => {
      if (!confirm(t('adminPlaces.deleteConfirm'))) return;
      try {
        await api.delete(`/admin/places/${placeId}`);
        this.load(this.currentPage);
      } catch (error) {
        alert(error.message);
      }
    };
    window.reimportPlaceArea = async function reimportPlaceArea(areaId) {
      this.disabled = true;
      this.textContent = t('adminPlaces.importing');
      try {
        await api.post(`/admin/place-areas/${areaId}/import`, {});
      } catch (error) {
        alert(error.message);
      }
      page.load(page.currentPage);
    };

    await this.load(1);
  },

  filters() {
    const params = new URLSearchParams();
    const add = (key, id) => {
      const value = document.getElementById(id)?.value.trim();
      if (value) params.set(key, value);
    };
    add('q', 'places-q');
    add('city', 'places-city');
    add('type', 'places-type');
    add('hidden', 'places-hidden');
    return params;
  },

  async load(page = 1) {
    const list = document.getElementById('places-list');
    const pagination = document.getElementById('places-pagination');
    if (!list) return;
    list.innerHTML = `<p class="loading">${t('common.loading')}</p>`;

    try {
      const params = this.filters();
      params.set('page', page);
      const res = await api.get(`/admin/places?${params}`);
      const {
        places, areas, total, pages,
      } = res.data;
      this.places = places;
      this.currentPage = page;
      this.renderAreas(areas);

      if (!places.length) {
        list.innerHTML = `<p class="no-results">${t('adminPlaces.empty')}</p>`;
        pagination.innerHTML = '';
        return;
      }

      list.innerHTML = places.map((p) => `
        <div class="property-list-item${p.hidden ? ' is-hidden' : ''}">
          <div class="property-info">
            <h3>${escapeHtml(p.name || placeTypeLabel(p.type))}</h3>
            <p>${escapeHtml(placeTypeLabel(p.type))} · ${escapeHtml([p.city, p.country].filter(Boolean).join(', ') || '—')}</p>
            <p class="field-hint">
              ${p.source === 'osm' ? t('adminPlaces.fromOsm') : t('adminPlaces.fromAdmin')}${p.admin_edited && p.source === 'osm' ? ` · ${t('adminPlaces.edited')}` : ''}${p.hidden ? ` · <strong>${t('adminPlaces.hidden')}</strong>` : ''}
            </p>
            ${p.opening_hours ? `<p class="field-hint">${escapeHtml(p.opening_hours)}</p>` : ''}
            ${p.note ? `<p class="field-hint">${escapeHtml(p.note)}</p>` : ''}
          </div>
          <div class="property-actions">
            <button type="button" class="btn btn-outline btn-sm" data-action="editPlace" data-arg="${p._id}">${t('common.edit')}</button>
            <button type="button" class="btn btn-outline btn-sm" data-action="togglePlaceHidden" data-arg="${p._id}" data-arg2="${p.hidden}">${p.hidden ? t('adminPlaces.show') : t('adminPlaces.hide')}</button>
            ${p.source === 'admin' ? `<button type="button" class="btn btn-danger btn-sm" data-action="deletePlace" data-arg="${p._id}">${t('adminPlaces.delete')}</button>` : ''}
          </div>
        </div>
      `).join('');

      pagination.innerHTML = pages > 1 ? `
        <button class="btn btn-outline btn-sm" ${page <= 1 ? 'disabled' : ''} data-action="placesPrevPage">← ${t('auditLog.prev')}</button>
        <span>${t('auditLog.pageOf').replace('{page}', page).replace('{pages}', pages).replace('{total}', total)}</span>
        <button class="btn btn-outline btn-sm" ${page >= pages ? 'disabled' : ''} data-action="placesNextPage">${t('auditLog.next')} →</button>
      ` : `<p class="field-hint">${t('auditLog.totalRecords').replace('{total}', total)}</p>`;
    } catch (error) {
      list.innerHTML = `<p class="error">${escapeHtml(error.message || t('adminPlaces.loadError'))}</p>`;
    }
  },

  renderAreas(areas = []) {
    const box = document.getElementById('areas-list');
    if (!box) return;
    if (!areas.length) {
      box.innerHTML = `<p class="no-results">${t('adminPlaces.noAreas')}</p>`;
      return;
    }
    box.innerHTML = areas.map((a) => `
      <div class="property-list-item">
        <div class="property-info">
          <h3>${escapeHtml([a.city, a.country].filter(Boolean).join(', ') || '—')}</h3>
          <p>${t(`adminPlaces.status.${a.status}`)} · ${t('adminPlaces.placesCount').replace('{count}', a.places_count || 0)}</p>
          <p class="field-hint">${t('adminPlaces.importedAt')}: ${formatDateTime(a.imported_at)}${a.last_error ? ` · ${escapeHtml(a.last_error)}` : ''}</p>
        </div>
        <div class="property-actions">
          <button type="button" class="btn btn-outline btn-sm" data-action="reimportPlaceArea" data-arg="${a._id}">${t('adminPlaces.reimport')}</button>
        </div>
      </div>
    `).join('');
  },

  async update(id, data) {
    try {
      await api.put(`/admin/places/${id}`, data);
      await this.load(this.currentPage);
    } catch (error) {
      alert(error.message);
    }
  },

  // Formulario para anadir (sin `place`) o corregir un lugar.
  showForm(place = null) {
    const box = document.getElementById('place-form-box');
    box.innerHTML = `
      <form id="place-form" class="admin-place-form">
        <h2>${place ? t('adminPlaces.editTitle') : t('adminPlaces.addTitle')}</h2>
        ${place?.source === 'osm' ? `<p class="field-hint">${t('adminPlaces.editOsmHint')}</p>` : ''}
        <div class="form-row">
          <div class="form-group">
            <label for="place-name">${t('adminPlaces.name')}</label>
            <input type="text" id="place-name" maxlength="200" value="${escapeHtml(place?.name || '')}" ${place ? '' : 'required'}>
          </div>
          <div class="form-group">
            <label for="place-type">${t('adminPlaces.type')}</label>
            <select id="place-type" required>${typeOptions(place?.type)}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="place-city">${t('adminPlaces.city')}</label>
            <input type="text" id="place-city" value="${escapeHtml(place?.city || '')}">
          </div>
          <div class="form-group">
            <label for="place-country">${t('adminPlaces.country')}</label>
            <select id="place-country">${countryOptions(place?.country || '', '—')}</select>
          </div>
        </div>
        <div class="form-group">
          <label for="place-hours">${t('adminPlaces.hours')}</label>
          <input type="text" id="place-hours" maxlength="300" value="${escapeHtml(place?.opening_hours || '')}" placeholder="Mo-Fr 09:00-18:00">
        </div>
        <div class="form-group">
          <label for="place-note">${t('adminPlaces.note')}</label>
          <input type="text" id="place-note" maxlength="500" value="${escapeHtml(place?.note || '')}">
        </div>
        ${locationPickerHtml({ kind: 'place' })}
        <p class="error" id="place-form-error" hidden></p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${t('common.save')}</button>
          <button type="button" class="btn btn-outline" id="place-cancel">${t('common.cancel')}</button>
        </div>
      </form>
    `;
    const picker = bindLocationPicker({
      initial: place?.geo,
      fill: (r) => fillEmptyFields(r, {
        address: null, neighborhood: null, city: 'place-city', country: 'place-country',
      }),
      getCountry: () => document.getElementById('place-country').value,
    });
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('place-cancel').addEventListener('click', () => { box.innerHTML = ''; });
    document.getElementById('place-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const geo = picker?.getPoint();
      if (!geo) return;
      const value = (id) => document.getElementById(id).value.trim();
      const data = {
        name: value('place-name'),
        type: value('place-type'),
        city: value('place-city'),
        country: value('place-country'),
        opening_hours: value('place-hours'),
        note: value('place-note'),
        geo,
      };
      const error = document.getElementById('place-form-error');
      try {
        if (place) await api.put(`/admin/places/${place._id}`, data);
        else await api.post('/admin/places', data);
        box.innerHTML = '';
        await this.load(this.currentPage);
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
  },
};

export default AdminPlacesPage;
