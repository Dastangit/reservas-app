import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { escapeHtml } from '../utils/escape.js';
import { formatPlace } from '../utils/places.js';

const t = (key) => i18n.t(key);

// Miniatura con la forma de la pantalla de un movil y el mismo recorte
// automatico que usa la portada (HeroCarousel): el admin ve como quedara.
const phoneThumb = (url) => (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)
  ? url.replace('/image/upload/', '/image/upload/c_fill,g_auto,ar_9:19/c_limit,w_240/f_auto,q_auto/')
  : url);

const statusBadge = (chosen) => {
  if (!chosen) return `<span class="status-badge">${t('adminHeroPhotos.notShown')}</span>`;
  if (!chosen.valid) return `<span class="status-badge pending">${t('adminHeroPhotos.invalid')}</span>`;
  return `<span class="status-badge active">${t('adminHeroPhotos.shown')}</span>`;
};

// Fotos de la portada: ninguna ciudad sale en el carrusel de la home hasta que
// el admin elige su foto entre las de sus anuncios activos.
const AdminHeroPhotosPage = {
  cities: [],

  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-hero-photos-page">
        <div class="container">
          <h1>${t('adminHeroPhotos.title')}</h1>
          <p class="page-subtitle">${t('adminHeroPhotos.subtitle')}</p>
          <div id="hero-photos-status" role="status" aria-live="polite"></div>
          <div id="hero-photos-list"><p class="loading">${t('common.loading')}</p></div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    // data-action: `this` es el boton; data-arg es la ciudad y data-arg2 la foto.
    window.chooseHeroPhoto = (cityIndex, photoIndex) => this.choose(Number(cityIndex), Number(photoIndex));
    window.removeHeroPhoto = (cityIndex) => this.remove(Number(cityIndex));

    await this.load();
  },

  async load() {
    const list = document.getElementById('hero-photos-list');
    if (!list) return;
    try {
      const response = await api.get('/admin/hero-photos');
      this.cities = response.data?.cities || [];
      this.renderList();
    } catch (error) {
      list.innerHTML = `<p class="error-message">${escapeHtml(error.message || t('adminHeroPhotos.loadFailed'))}</p>`;
    }
  },

  renderList() {
    const list = document.getElementById('hero-photos-list');
    if (!list) return;
    if (this.cities.length === 0) {
      list.innerHTML = `<p class="no-results">${t('adminHeroPhotos.empty')}</p>`;
      return;
    }

    list.innerHTML = this.cities.map((city, cityIndex) => {
      const chosenUrl = city.chosen?.valid ? city.chosen.url : null;
      const photos = city.photos.map((photo, photoIndex) => {
        const selected = photo.url === chosenUrl;
        return `
          <button type="button" class="hero-photo-option${selected ? ' is-selected' : ''}" aria-pressed="${selected}"
            data-action="chooseHeroPhoto" data-arg="${cityIndex}" data-arg2="${photoIndex}">
            <img src="${escapeHtml(phoneThumb(photo.url))}" alt="${escapeHtml(photo.name || '')}" loading="lazy">
            <span class="hero-photo-option__name">${escapeHtml(photo.name || '')}</span>
          </button>
        `;
      }).join('');

      return `
        <section class="hero-photo-city">
          <div class="hero-photo-city__head">
            <h2>${escapeHtml(formatPlace({ city: city.city, country: city.country }))}</h2>
            ${statusBadge(city.chosen)}
            ${city.chosen ? `<button type="button" class="btn btn-outline btn-sm" data-action="removeHeroPhoto" data-arg="${cityIndex}">${t('adminHeroPhotos.remove')}</button>` : ''}
          </div>
          ${photos
            ? `<p class="field-hint">${t('adminHeroPhotos.chooseHint')}</p><div class="hero-photo-grid">${photos}</div>`
            : `<p class="field-hint">${t('adminHeroPhotos.noActivePhotos')}</p>`}
        </section>
      `;
    }).join('');
  },

  showStatus(message, ok) {
    const el = document.getElementById('hero-photos-status');
    if (!el) return;
    el.className = ok ? 'success-message' : 'error-message';
    el.textContent = message;
  },

  async choose(cityIndex, photoIndex) {
    const photo = this.cities[cityIndex]?.photos[photoIndex];
    if (!photo) return;
    try {
      await api.put('/admin/hero-photos', { source_type: photo.source_type, source_id: photo.source_id, url: photo.url });
      this.showStatus(t('adminHeroPhotos.saved'), true);
      await this.load();
    } catch (error) {
      this.showStatus(error.message || t('adminHeroPhotos.saveFailed'), false);
    }
  },

  async remove(cityIndex) {
    const chosen = this.cities[cityIndex]?.chosen;
    if (!chosen) return;
    try {
      await api.delete(`/admin/hero-photos/${chosen.id}`);
      this.showStatus(t('adminHeroPhotos.removed'), true);
      await this.load();
    } catch (error) {
      this.showStatus(error.message || t('adminHeroPhotos.saveFailed'), false);
    }
  },
};

export default AdminHeroPhotosPage;
