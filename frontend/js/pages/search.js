import api from '../api.js';
import PropertyCard from '../components/PropertyCard.js';
import i18n from '../i18n.js';

const SearchPage = {
  meta() {
    return { title: i18n.t('seo.search.title'), description: i18n.t('seo.search.description') };
  },

  currentFilters: {},

  async render() {
    const t = (key) => i18n.t(key);
    const params = new URLSearchParams(window.location.search);
    this.currentFilters = {
      city: params.get('city') || '',
      check_in: params.get('check_in') || '',
      check_out: params.get('check_out') || '',
      min_price: params.get('min_price') || '',
      max_price: params.get('max_price') || '',
      type: params.get('type') || '',
      sort_by: params.get('sort_by') || 'newest',
    };

    return `
      <div class="search-page">
        <div class="container">
          <div class="search-header">
            <h1>${t('search.title')}</h1>
          </div>
          
          <div class="search-layout">
            <aside class="search-filters">
              <h3>${t('search.filters')}</h3>
              <form id="filter-form">
                <div class="filter-group">
                  <label>${t('search.city')}</label>
                  <input type="text" id="filter-city" value="${this.currentFilters.city}" placeholder="${t('search.cityPlaceholder')}">
                </div>
                
                <div class="filter-group">
                  <label>${t('booking.checkIn')}</label>
                  <input type="date" id="filter-checkin" value="${this.currentFilters.check_in}">
                </div>
                
                <div class="filter-group">
                  <label>${t('booking.checkOut')}</label>
                  <input type="date" id="filter-checkout" value="${this.currentFilters.check_out}">
                </div>
                
                <div class="filter-group">
                  <label>${t('search.priceRange')}</label>
                  <div class="price-range">
                    <input type="number" id="filter-min-price" value="${this.currentFilters.min_price}" placeholder="${t('search.min')}">
                    <span>-</span>
                    <input type="number" id="filter-max-price" value="${this.currentFilters.max_price}" placeholder="${t('search.max')}">
                  </div>
                </div>
                
                <div class="filter-group">
                  <label>${t('search.type')}</label>
                  <select id="filter-type">
                    <option value="">${t('search.allTypes')}</option>
                    <option value="casa_particular" ${this.currentFilters.type === 'casa_particular' ? 'selected' : ''}>Casa Particular</option>
                    <option value="hostel" ${this.currentFilters.type === 'hostel' ? 'selected' : ''}>${t('search.hostel')}</option>
                  </select>
                </div>
                
                <div class="filter-group">
                  <label>${t('search.sortBy')}</label>
                  <select id="filter-sort">
                    <option value="newest" ${this.currentFilters.sort_by === 'newest' ? 'selected' : ''}>${t('search.newest')}</option>
                    <option value="price_asc" ${this.currentFilters.sort_by === 'price_asc' ? 'selected' : ''}>${t('search.priceLowHigh')}</option>
                    <option value="price_desc" ${this.currentFilters.sort_by === 'price_desc' ? 'selected' : ''}>${t('search.priceHighLow')}</option>
                    <option value="rating_desc" ${this.currentFilters.sort_by === 'rating_desc' ? 'selected' : ''}>${t('search.rating')}</option>
                  </select>
                </div>
                
                <button type="submit" class="btn btn-primary btn-block">${t('search.applyFilters')}</button>
              </form>
            </aside>
            
            <main class="search-results">
              <div id="results-count" class="results-count"></div>
              <div id="properties-grid" class="properties-grid">
                <p class="loading">${t('search.loadingProperties')}</p>
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

    await this.loadProperties();
  },

  async applyFilters() {
    const filters = {
      city: document.getElementById('filter-city')?.value || '',
      check_in: document.getElementById('filter-checkin')?.value || '',
      check_out: document.getElementById('filter-checkout')?.value || '',
      min_price: document.getElementById('filter-min-price')?.value || '',
      max_price: document.getElementById('filter-max-price')?.value || '',
      type: document.getElementById('filter-type')?.value || '',
      sort_by: document.getElementById('filter-sort')?.value || 'newest',
    };

    let url = '/search?';
    Object.entries(filters).forEach(([key, value]) => {
      if (value) url += `${key}=${encodeURIComponent(value)}&`;
    });

    window.history.pushState({}, '', url);
    await this.loadProperties();
  },

  async loadProperties() {
    const grid = document.getElementById('properties-grid');
    const countEl = document.getElementById('results-count');
    if (!grid) return;

    grid.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const params = new URLSearchParams(window.location.search);
      const response = await api.get(`/search?${params.toString()}`);
      const properties = response.data?.results || [];
      const total = response.data?.total_count || 0;

      countEl.textContent = `${total} ${i18n.t('search.resultsFound')}`;
      grid.innerHTML = PropertyCard.renderGrid(properties);
    } catch (error) {
      grid.innerHTML = `<p class="error">${i18n.t('search.errorLoading')}</p>`;
    }
  }
};

export default SearchPage;
