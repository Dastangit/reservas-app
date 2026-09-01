import api from '../api.js';

// Carrusel de fondo del hero: muestra fotos reales de ciudades donde ya
// hay propiedades o excursiones activas (ver GET /search/destinations).
// Si aun no hay destinos, render() devuelve '' y el hero se ve como antes
// (sin espacios rotos ni placeholders).
const HeroCarousel = {
  _destinations: [],
  _intervalId: null,

  async fetchDestinations() {
    try {
      const response = await api.get('/search/destinations?limit=8');
      return response.data?.destinations || [];
    } catch (error) {
      console.error('Error loading destinations:', error);
      return [];
    }
  },

  render(destinations) {
    this._destinations = destinations || [];
    if (this._destinations.length === 0) return '';

    const slides = this._destinations.map((d, i) => `
      <div class="hero-carousel__slide${i === 0 ? ' is-active' : ''}" role="img" aria-label="${d.city}">
        <div class="hero-carousel__slide-blur" style="background-image:url('${d.image_url}')"></div>
        <div class="hero-carousel__slide-img" style="background-image:url('${d.image_url}')"></div>
      </div>
    `).join('');

    return `
      <div class="hero-carousel" id="hero-carousel">
        ${slides}
      </div>
      <div class="hero-overlay"></div>
    `;
  },

  init() {
    const container = document.getElementById('hero-carousel');
    if (!container || this._destinations.length < 2) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const slides = container.querySelectorAll('.hero-carousel__slide');
    let current = 0;

    const start = () => {
      this._intervalId = setInterval(() => {
        // Si la pagina cambio y este nodo ya no esta en el DOM, se
        // autodestruye -- el router de esta app no tiene hook de "destroy".
        if (!document.body.contains(container)) {
          clearInterval(this._intervalId);
          this._intervalId = null;
          return;
        }
        slides[current].classList.remove('is-active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('is-active');
      }, 6000);
    };

    start();

    container.addEventListener('mouseenter', () => clearInterval(this._intervalId));
    container.addEventListener('mouseleave', start);
  },
};

export default HeroCarousel;
