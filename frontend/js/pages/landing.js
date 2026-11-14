import api from '../api.js';
import PropertyCard from '../components/PropertyCard.js';
import HeroCarousel from '../components/HeroCarousel.js';
import HeroLantern from '../components/HeroLantern.js';
import i18n from '../i18n.js';

const LandingPage = {
  meta() {
    return { title: i18n.t('seo.landing.title'), description: i18n.t('seo.landing.description') };
  },

  async render() {
    const t = (key) => i18n.t(key);
    let featuredProperties = [];

    try {
      const response = await api.get('/properties?limit=6');
      featuredProperties = response.data?.properties || [];
    } catch (error) {
      console.error('Error loading featured properties:', error);
    }

    const destinations = await HeroCarousel.fetchDestinations();

    return `
      <section class="hero" data-time="${HeroLantern.defaultTime}">
        ${HeroCarousel.render(destinations)}
        ${HeroLantern.renderLayers()}
        ${HeroLantern.render()}
        <div class="container">
          <h1>
            <span class="hero-slogan" lang="en">${t('hero.title')}</span>
            <span class="hero-tagline">${t('hero.subtitle')}</span>
          </h1>
          <div class="search-box">
            <input type="text" id="search-city" placeholder="${t('hero.searchPlaceholder')}" aria-label="${t('hero.searchPlaceholder')}">
            <div class="search-date-field">
              <label for="check-in">${t('booking.checkIn')}</label>
              <input type="date" id="check-in">
            </div>
            <div class="search-date-field">
              <label for="check-out">${t('booking.checkOut')}</label>
              <input type="date" id="check-out">
            </div>
            <button type="button" data-action="handleSearch" class="btn btn-cta">${t('hero.searchBtn')}</button>
          </div>
          <a href="/how-it-works" data-link class="hero-how-it-works-link">${t('howItWorks.title')}</a>
        </div>
      </section>

      <section class="featured">
        <div class="container">
          <h2>${t('property.featuredTitle')}</h2>
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
          <a href="/register?role=host" data-link class="btn btn-cta">${t('host.becomeHostBtn')}</a>
        </div>
      </section>
    `;
  },

  init() {
    HeroCarousel.init();
    HeroLantern.init();
    revealOnScroll(document.getElementById('properties-grid'));

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

// Las tarjetas aparecen una tras otra al llegar a ellas. La clase la pone JS:
// sin JS (portada prerenderizada) o con movimiento reducido se ven sin mas.
function revealOnScroll(grid) {
  if (!grid || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  grid.classList.add('reveal');
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    grid.classList.add('is-revealed');
    observer.disconnect();
  }, { threshold: 0.15 });
  observer.observe(grid);
}

export default LandingPage;
