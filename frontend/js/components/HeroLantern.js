import i18n from '../i18n.js';

// Farol de la portada: cuelga del borde de la cabecera fija y cambia la luz
// de las fotos del hero (amanecer, dia, atardecer, noche). Empieza en la hora
// local del visitante y cada toque pasa a la siguiente. Hasta el primer toque
// su luz "respira" para invitar a tocarlo; sin texto que lo explique.
const TIMES = ['dawn', 'day', 'dusk', 'night'];

function timeForHour(hour) {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

function label(time) {
  return `${i18n.t('hero.lantern.label')} (${i18n.t(`hero.lantern.${time}`)})`;
}

const HeroLantern = {
  // render() devuelve el hero en "day": la portada prerenderizada no sabe la
  // hora del visitante. init() la pone sin transicion.
  defaultTime: 'day',

  // Capas de color sobre las fotos: van en .hero, despues del carrusel.
  renderLayers() {
    return `
      <div class="hero-tod hero-tod--dawn" aria-hidden="true"></div>
      <div class="hero-tod hero-tod--dusk" aria-hidden="true"></div>
      <div class="hero-tod hero-tod--night" aria-hidden="true"></div>
      <div class="hero-lantern-glow" aria-hidden="true"></div>
    `;
  },

  render() {
    return `
      <span class="hero-lantern-mount" aria-hidden="true"></span>
      <button type="button" class="hero-lantern" aria-label="${label(this.defaultTime)}">
        <span class="hero-lantern__halo"></span>
        <svg viewBox="0 0 52 112" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="hero-lantern-metal" x1="0" x2="1">
              <stop offset="0" class="hero-lantern__stop-dark"/>
              <stop offset=".45" class="hero-lantern__stop-light"/>
              <stop offset="1" class="hero-lantern__stop-dark"/>
            </linearGradient>
          </defs>
          <g class="hero-lantern__chain">
            <ellipse cx="26" cy="5" rx="2.2" ry="4"/><ellipse cx="26" cy="13" rx="1.4" ry="4"/>
            <ellipse cx="26" cy="21" rx="2.2" ry="4"/><ellipse cx="26" cy="29" rx="1.4" ry="4"/>
          </g>
          <circle class="hero-lantern__ring" cx="26" cy="37" r="3.5"/>
          <path class="hero-lantern__metal" d="M26 40 L44 52 H8 Z"/>
          <rect class="hero-lantern__frame-fill" x="6" y="51" width="40" height="4" rx="1.5"/>
          <path class="hero-lantern__light" d="M11 55 H41 L38 92 H14 Z"/>
          <ellipse class="hero-lantern__flame" cx="26" cy="78" rx="4" ry="8.5"/>
          <path class="hero-lantern__glass" d="M11 55 H41 L38 92 H14 Z"/>
          <path class="hero-lantern__frame" d="M11 55 H41 L38 92 H14 Z M20.5 55 L19.5 92 M31.5 55 L32.5 92"/>
          <path class="hero-lantern__frame hero-lantern__frame--thin" d="M13 66 H39"/>
          <path class="hero-lantern__metal" d="M12 92 H40 L36 99 H16 Z"/>
          <path class="hero-lantern__frame-fill" d="M22 99 H30 L28 104 H24 Z"/>
        </svg>
      </button>
    `;
  },

  init() {
    const hero = document.querySelector('.hero');
    const button = hero?.querySelector('.hero-lantern');
    if (!button) return;

    const setTime = (time) => {
      hero.dataset.time = time;
      button.setAttribute('aria-label', label(time));
    };

    // La hora inicial se pone sin animar: si no, cada visita nocturna veria
    // la foto pasar de dia a noche al cargar.
    hero.classList.add('hero--instant');
    setTime(timeForHour(new Date().getHours()));
    requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.remove('hero--instant')));

    button.addEventListener('click', () => {
      button.classList.add('is-lit');
      button.classList.remove('is-swinging');
      void button.offsetWidth; // reinicia la animacion si se toca seguido
      button.classList.add('is-swinging');
      const next = TIMES[(TIMES.indexOf(hero.dataset.time) + 1) % TIMES.length];
      setTime(next);
    });
  },
};

export default HeroLantern;
