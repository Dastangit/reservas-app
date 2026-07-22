import api from '../api.js';
import PropertyCard from '../components/PropertyCard.js';
import i18n from '../i18n.js';

const LandingPage = {
  async render() {
    const t = (key) => i18n.t(key);
    let featuredProperties = [];

    try {
      const response = await api.get('/properties?limit=6');
      featuredProperties = response.data?.properties || [];
    } catch (error) {
      console.error('Error loading featured properties:', error);
    }

    return `
      <section class="hero">
        <div class="container">
          <h2>${t('hero.title')}</h2>
          <p>${t('hero.subtitle')}</p>
          <div class="search-box">
            <input type="text" id="search-city" placeholder="${t('hero.searchPlaceholder')}">
            <div class="search-date-field">
              <label for="check-in">${t('booking.checkIn')}</label>
              <input type="date" id="check-in">
            </div>
            <div class="search-date-field">
              <label for="check-out">${t('booking.checkOut')}</label>
              <input type="date" id="check-out">
            </div>
            <button onclick="handleSearch()" class="btn btn-secondary">${t('hero.searchBtn')}</button>
          </div>
          <a href="/how-it-works" data-link class="btn hero-how-it-works-btn">${t('howItWorks.title')}</a>
        </div>
      </section>

      <section class="featured">
        <div class="container">
          <h2>${t('property.viewDetails')}</h2>
          <div id="properties-grid" class="properties-grid">
            ${PropertyCard.renderGrid(featuredProperties)}
          </div>
          <div class="text-center mt-4">
            <a href="/search" data-link class="btn btn-outline">${t('common.search')}</a>
          </div>
        </div>
      </section>

      <section class="cta-section">
        <div class="container">
          <h2>${t('host.becomeHost')}</h2>
          <p>${t('host.becomeHostDesc')}</p>
          <a href="/register?role=host" data-link class="btn btn-secondary">${t('host.becomeHostBtn')}</a>
        </div>
      </section>
    `;
  },

  init() {
    window.handleSearch = () => {
      const city = document.getElementById('search-city')?.value;
      const checkIn = document.getElementById('check-in')?.value;
      const checkOut = document.getElementById('check-out')?.value;

      let url = '/search?';
      if (city) url += `city=${encodeURIComponent(city)}&`;
      if (checkIn) url += `check_in=${checkIn}&`;
      if (checkOut) url += `check_out=${checkOut}&`;

      window.location.href = url;
    };
  }
};

export default LandingPage;
