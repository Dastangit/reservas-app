import api from '../api.js';
import { escapeHtml } from '../utils/escape.js';

// Carrusel de fondo del hero: muestra fotos reales de ciudades donde ya
// hay propiedades o excursiones activas (ver GET /search/destinations).
// Si aun no hay destinos, render() devuelve '' y el hero se ve como antes
// (sin espacios rotos ni placeholders).
// Las fotos que suben los anfitriones pueden pesar mas de 1 MB (PNG). Cloudinary
// las entrega en el formato y la calidad que mejor carga en cada navegador, con
// el ancho de la pantalla, para que no tarden en aparecer sobre la playa.
const heroImageUrl = (url) => {
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  const width = window.innerWidth <= 768 ? 900 : 1920;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
};

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
      <div class="hero-carousel__slide${i === 0 ? ' is-active' : ''}" role="img" aria-label="${escapeHtml(d.city)}">
        <div class="hero-carousel__slide-img" style="background-image:url('${escapeHtml(heroImageUrl(d.image_url))}')"></div>
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
