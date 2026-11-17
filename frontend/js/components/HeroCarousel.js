import api from '../api.js';
import { escapeHtml } from '../utils/escape.js';

// Carrusel de fondo del hero: muestra fotos reales de ciudades donde ya
// hay propiedades o excursiones activas (ver GET /search/destinations).
// Si aun no hay destinos, render() devuelve '' y el hero se ve como antes
// (sin espacios rotos ni placeholders).
// Cada anfitrion sube fotos de cualquier forma y tamano (horizontales, PNG de
// mas de 1 MB...). Cloudinary las recorta a la forma de la pantalla (vertical
// en el movil) eligiendo la parte con contenido (g_auto, no el centro a ciegas),
// las achica hasta la pantalla sin agrandarlas nunca (c_limit) y las entrega en
// el formato y la calidad que mejor cargan.
// Las medidas se redondean a 200 px para reutilizar las mismas versiones.
const HERO_STEP = 200;
const HERO_MAX = 2400;
const roundUp = (n) => Math.ceil(n / HERO_STEP) * HERO_STEP;

const heroImageUrl = (url) => {
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  // El hero ocupa la primera pantalla (560 px como minimo, ver .hero en styles.css).
  const cssWidth = window.innerWidth;
  const cssHeight = Math.max(560, window.innerHeight);
  // Hasta 2x de densidad y 2400 px por lado, con la misma escala en los dos.
  const scale = Math.min(window.devicePixelRatio || 1, 2, HERO_MAX / cssWidth, HERO_MAX / cssHeight);
  const width = roundUp(cssWidth * scale);
  const height = roundUp(cssHeight * scale);
  return url.replace('/image/upload/', `/image/upload/c_fill,g_auto,ar_${width}:${height}/c_limit,w_${width},h_${height}/f_auto,q_auto/`);
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
