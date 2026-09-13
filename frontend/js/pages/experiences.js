import api from '../api.js';
import i18n from '../i18n.js';
import { formatExperiencePrice } from '../utils/formatters.js';

const ExperiencesPage = {
  meta() {
    return { title: i18n.t('seo.experiences.title'), description: i18n.t('seo.experiences.description') };
  },

  currentFilters: {},

  async render() {
    const t = (key) => i18n.t(key);
    const params = new URLSearchParams(window.location.search);
    this.currentFilters = {
      city: params.get('city') || '',
      category: params.get('category') || '',
      audience: params.get('audience') || '',
    };

    return `
      <div class="experiences-page">
        <div class="container">
          <div class="search-header">
            <h1>${t('experience.pageTitle')}</h1>
            <p style="color:var(--text-light);">${t('experience.pageSubtitle')}</p>
          </div>

          <div class="search-layout">
            <aside class="search-filters">
              <h3>${t('experience.filters')}</h3>
              <form id="filter-form">
                <div class="filter-group">
                  <label>${t('search.city')}</label>
                  <input type="text" id="filter-city" value="${this.currentFilters.city}" placeholder="${t('search.cityPlaceholder')}">
                </div>

                <div class="filter-group">
                  <label>${t('experience.category')}</label>
                  <input type="text" id="filter-category" value="${this.currentFilters.category}" placeholder="${t('experience.categoryPlaceholder')}">
                </div>

                <div class="filter-group">
                  <label>${t('experience.audienceLabel')}</label>
                  <select id="filter-audience">
                    <option value="">${t('experience.allAudiences')}</option>
                    <option value="tourist" ${this.currentFilters.audience === 'tourist' ? 'selected' : ''}>${t('experience.tourist')}</option>
                    <option value="local" ${this.currentFilters.audience === 'local' ? 'selected' : ''}>${t('experience.local')}</option>
                  </select>
                </div>

                <button type="submit" class="btn btn-primary btn-block">${t('search.applyFilters')}</button>
              </form>
            </aside>

            <main class="search-results">
              <div id="results-count" class="results-count"></div>
              <div id="experiences-grid" class="properties-grid">
                <p class="loading">${t('experience.loading')}</p>
              </div>
            </main>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    const form = document.getElementById('filter-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.applyFilters();
      });
    }

    await this.loadExperiences();
  },

  applyFilters() {
    const filters = {
      city: document.getElementById('filter-city')?.value || '',
      category: document.getElementById('filter-category')?.value || '',
      audience: document.getElementById('filter-audience')?.value || '',
    };

    let url = '/experiences?';
    Object.entries(filters).forEach(([key, value]) => {
      if (value) url += `${key}=${encodeURIComponent(value)}&`;
    });

    window.history.pushState({}, '', url);
    this.loadExperiences();
  },

  async loadExperiences() {
    const grid = document.getElementById('experiences-grid');
    const countEl = document.getElementById('results-count');
    if (!grid) return;

    grid.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const params = new URLSearchParams(window.location.search);
      const response = await api.get(`/experiences?${params.toString()}`);
      const experiences = response.data?.experiences || [];
      const total = response.data?.total_count ?? experiences.length;

      countEl.textContent = `${total} ${i18n.t('experience.resultsFound')}`;

      if (experiences.length === 0) {
        grid.innerHTML = `<p class="no-results">${i18n.t('experience.noResults')}</p>`;
        return;
      }

      grid.innerHTML = experiences.map((exp) => {
        const spotsLeft = Math.max((exp.max_participants || 0) - (exp.current_participants || 0), 0);
        const firstPrice = exp.pricing?.[0];
        const priceLabel = firstPrice
          ? `${i18n.t('experience.fromPrice')} ${formatExperiencePrice(firstPrice.amount, firstPrice.currency)}`
          : i18n.t('experience.inquirePrice');

        return `
          <a href="/experiences/${exp._id}" data-link class="property-card">
            <img src="${exp.images?.[0]?.url || 'https://via.placeholder.com/300x200'}" alt="${exp.title}">
            <div class="property-card-body">
              <h3>${exp.title}</h3>
              <p>${exp.location?.city || ''} · ${new Date(exp.date).toLocaleDateString(i18n.currentLang)}</p>
              <p>${priceLabel}</p>
              <p style="font-size:0.85rem;color:var(--text-light);">${spotsLeft} ${i18n.t('experience.spotsAvailable')}</p>
            </div>
          </a>
        `;
      }).join('');
    } catch (error) {
      grid.innerHTML = `<p class="error">${i18n.t('experience.errorLoadingList')}</p>`;
    }
  },
};

export default ExperiencesPage;
