import auth from '../auth.js';
import i18n from '../i18n.js';
import api from '../api.js';
import { subscribeAdminToPush, syncAdminPushSubscription } from '../utils/adminPush.js';
import router from '../router.js';
import { escapeHtml } from '../utils/escape.js';

// Iconos del boton de tema: dos SVG del mismo trazo (el sol en caracter salia
// como emoji en algunos sistemas y la luna no).
const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

// Iconos de trazo para el menu del movil (24x24, estilo Lucide).
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// Fila del menu movil: enlace con icono, texto, contador opcional y flecha.
// `count` es la clave de /admin/pending-counts que pone el numero (admin).
const drawerLink = (href, iconName, label, { count } = {}) => `
  <a href="${href}" data-link class="drawer-item">
    <span class="drawer-icon">${icon(iconName)}</span>
    <span class="drawer-label">${label}</span>
    ${count ? `<span class="drawer-badge" data-count="${count}" hidden></span>` : ''}
    <span class="drawer-chevron">${icon('chevron')}</span>
  </a>`;

// Fila que abre o cierra una seccion dentro de su tarjeta (Mas, Notificaciones).
const drawerToggle = (panelId, iconName, label, { count } = {}) => `
  <button type="button" class="drawer-item" data-action="toggleDrawerSection" aria-expanded="false" aria-controls="${panelId}">
    <span class="drawer-icon">${icon(iconName)}</span>
    <span class="drawer-label">${label}</span>
    ${count ? `<span class="drawer-badge" data-count="${count}" hidden></span>` : ''}
    <span class="drawer-chevron">${icon('chevron')}</span>
  </button>`;

const drawerGroup = (title, content) => `
  <p class="drawer-group-title">${title}</p>
  <div class="drawer-group">${content}</div>`;

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2)
  .map((word) => word[0]).join('').toUpperCase();

// Menu del movil: panel lateral con la cuenta arriba, los enlaces agrupados
// en tarjetas y, abajo, idioma, tema y salir. En el ordenador se usa .nav.
function drawerHtml({ role, user, t, experiencesEnabled }) {
  const isLoggedIn = Boolean(role);
  const experiences = experiencesEnabled ? drawerLink('/experiences', 'compass', t('header.experiences')) : '';
  const profileHref = role === 'host' ? '/host/profile' : '/profile';
  const account = isLoggedIn ? `
    <a href="${profileHref}" data-link class="drawer-account">
      <span class="drawer-avatar" aria-hidden="true">${escapeHtml(initials(user?.name))}</span>
      <span class="drawer-account-text">
        <span class="drawer-account-name">${escapeHtml(user?.name || t('common.profile'))}</span>
        <span class="drawer-account-sub">${t(`drawer.role.${role}`)} · ${t('drawer.viewProfile')}</span>
      </span>
      <span class="drawer-chevron">${icon('chevron')}</span>
    </a>` : `
    <div class="drawer-welcome">
      <p class="drawer-welcome-title">${t('drawer.welcomeTitle')}</p>
      <p class="drawer-welcome-text">${t('drawer.welcomeText')}</p>
      <a href="/register" data-link class="btn btn-cta">${t('common.register')}</a>
      <a href="/login" data-link class="btn btn-outline">${t('common.login')}</a>
    </div>`;

  let groups = '';
  if (!isLoggedIn) {
    groups = drawerGroup(t('drawer.explore'), drawerLink('/', 'home', t('common.home')) + experiences
      + drawerLink('/how-it-works', 'book', t('footer.howItWorks')) + drawerLink('/faq', 'help', t('footer.faq')))
      + `<a href="/register?role=host" data-link class="drawer-host-card">
          <span class="drawer-icon">${icon('building')}</span>
          <span><strong>${t('drawer.hostCardTitle')}</strong><span>${t('drawer.hostCardText')}</span></span>
        </a>`;
  } else if (role === 'tourist') {
    groups = drawerGroup(t('drawer.explore'), drawerLink('/', 'home', t('common.home'))
      + drawerLink('/search', 'search', t('drawer.searchStays')) + experiences)
      + drawerGroup(t('drawer.account'), drawerLink('/dashboard', 'calendar', t('nav.myBookings'))
      + drawerLink('/faq', 'help', t('drawer.help')));
  } else if (role === 'host') {
    groups = drawerGroup(t('drawer.hosting'), drawerLink('/host/dashboard', 'dash', t('host.dashboard'))
      + drawerLink('/host/properties', 'building', t('host.myProperties'))
      + drawerLink('/host/bookings', 'calendar', t('nav.myBookings'))
      + drawerLink('/host/earnings', 'wallet', t('host.earnings')))
      + drawerGroup(t('drawer.account'), drawerLink('/faq', 'help', t('drawer.help')));
  } else if (role === 'organizer') {
    groups = drawerGroup(t('drawer.organizing'), drawerLink('/organizer/dashboard', 'dash', t('header.organizerDashboard'))
      + drawerLink('/organizer/experiences', 'compass', t('header.myExperiences'))
      + drawerLink('/organizer/recurrences', 'repeat', t('header.recurrences'))
      + drawerLink('/organizer/bookings', 'calendar', t('header.bookings')))
      + drawerGroup(t('drawer.account'), drawerLink('/faq', 'help', t('drawer.help')));
  } else if (role === 'admin') {
    const sub = (href, label) => `<a href="${href}" data-link>${label}</a>`;
    groups = drawerGroup(t('drawer.manage'), drawerLink('/admin/dashboard', 'dash', t('admin.dashboard'))
      + drawerLink('/admin/bookings', 'calendar', t('header.bookings'), { count: 'bookings' })
      + drawerLink('/admin/properties', 'building', t('header.properties'), { count: 'properties' })
      + drawerLink('/admin/users', 'users', t('header.hosts'))
      + drawerToggle('drawer-notif', 'bell', t('header.notifications'), { count: 'total' })
      + `<div class="drawer-sub" id="drawer-notif" hidden><p class="drawer-sub-note">${t('common.loading')}</p></div>`)
      + drawerGroup(t('header.more'), drawerToggle('drawer-more', 'more', t('drawer.moreOptions'))
      + `<div class="drawer-sub" id="drawer-more" hidden>
          <p class="drawer-sub-title">${t('drawer.payments')}</p>
          ${sub('/admin/orphaned-payments', t('header.orphanedPayments'))}
          ${sub('/admin/host-commissions', t('header.hostCommissions'))}
          ${experiencesEnabled ? sub('/admin/organizer-commissions', t('header.organizerCommissions')) : ''}
          ${experiencesEnabled ? `
            <p class="drawer-sub-title">${t('header.experiences')}</p>
            ${sub('/admin/organizers', t('header.organizers'))}
            ${sub('/admin/experiences', t('header.pendingExperiences'))}
            ${sub('/admin/experience-bookings', t('header.experienceBookings'))}
          ` : ''}
          <p class="drawer-sub-title">${t('drawer.system')}</p>
          ${sub('/admin/availability', t('header.availability'))}
          ${sub('/admin/places', t('header.places'))}
          ${sub('/admin/password-resets', t('header.passwordResets'))}
          ${sub('/admin/audit-log', t('header.auditLog'))}
          ${sub('/admin/feedback', t('nav.feedback'))}
          ${sub('/admin/reports', t('nav.reports'))}
          ${sub('/admin/settings', t('nav.settings'))}
        </div>`);
  }

  const langs = i18n.getLangs().map((lang) => `
    <button type="button" data-action="changeLang" data-arg="${escapeHtml(lang.code)}" lang="${escapeHtml(lang.code)}"
      aria-pressed="${lang.code === i18n.currentLang}" aria-label="${escapeHtml(lang.label)}">${escapeHtml(lang.code.toUpperCase())}</button>`).join('');
  const dark = isDarkTheme();

  return `
    <div class="drawer-backdrop" hidden></div>
    <nav class="drawer" id="mobile-drawer" aria-label="${t('header.menu')}" hidden>
      <div class="drawer-top">
        <a href="/" data-link class="drawer-logo"><img src="/assets/logo-elysio.svg" alt="Elysio Experiences" class="logo-img"></a>
        <button type="button" class="drawer-close" data-action="closeMobileMenu" aria-label="${t('drawer.close')}">${icon('close')}</button>
      </div>
      <div class="drawer-body">
        ${account}
        ${groups}
      </div>
      <div class="drawer-foot">
        <div class="drawer-prefs">
          <div class="drawer-langs" role="group" aria-label="${t('common.language')}">${langs}</div>
          <button type="button" class="theme-toggle" data-action="toggleTheme" aria-label="${t(dark ? 'common.themeToLight' : 'common.themeToDark')}">
            ${dark ? SUN_ICON : MOON_ICON}
          </button>
        </div>
        ${isLoggedIn ? `<button type="button" class="drawer-logout" data-action="logout">${icon('logout')} ${t('common.logout')}</button>` : ''}
      </div>
    </nav>`;
}

const Header = {
  render() {
    const isLoggedIn = auth.isLoggedIn();
    const role = auth.getRole();
    const user = auth.getUser();
    const t = (key) => i18n.t(key);

    const langOptions = i18n.getLangs().map((lang) =>
      `<option value="${escapeHtml(lang.code)}" ${lang.code === i18n.currentLang ? 'selected' : ''}>${escapeHtml(lang.label)}</option>`
    ).join('');

    let navLinks = '';
    const experiencesEnabled = window.APP_CONFIG?.features?.experiences_module;
    const experiencesLink = experiencesEnabled ? `<a href="/experiences" data-link>${t('header.experiences')}</a>` : '';

    if (!isLoggedIn) {
      navLinks = `
        <a href="/" data-link>${t('common.home')}</a>
        ${experiencesLink}
        <a href="/login" data-link class="btn btn-outline">${t('common.login')}</a>
        <a href="/register" data-link class="btn btn-primary">${t('common.register')}</a>
      `;
    } else if (role === 'tourist') {
      navLinks = `
        <a href="/" data-link>${t('common.home')}</a>
        <a href="/search" data-link>${t('common.search')}</a>
        ${experiencesLink}
        <a href="/dashboard" data-link>${t('nav.myBookings')}</a>
        <a href="/profile" data-link class="nav-user">${escapeHtml(user?.name || t('common.profile'))}</a>
        <button data-action="logout" class="btn btn-outline">${t('common.logout')}</button>
      `;
    } else if (role === 'host') {
      navLinks = `
        <a href="/host/dashboard" data-link>${t('host.dashboard')}</a>
        <a href="/host/properties" data-link>${t('host.myProperties')}</a>
        <a href="/host/bookings" data-link>${t('nav.myBookings')}</a>
        <a href="/host/earnings" data-link>${t('host.earnings')}</a>
        <a href="/host/profile" data-link class="nav-user">${escapeHtml(user?.name || t('common.profile'))}</a>
        <button data-action="logout" class="btn btn-outline">${t('common.logout')}</button>
      `;
    } else if (role === 'organizer') {
      navLinks = `
        <a href="/organizer/dashboard" data-link>${t('header.organizerDashboard')}</a>
        <a href="/organizer/experiences" data-link>${t('header.myExperiences')}</a>
        <a href="/organizer/recurrences" data-link>${t('header.recurrences')}</a>
        <a href="/organizer/bookings" data-link>${t('header.bookings')}</a>
        <a href="/profile" data-link class="nav-user">${escapeHtml(user?.name || t('common.profile'))}</a>
        <button data-action="logout" class="btn btn-outline">${t('common.logout')}</button>
      `;
    } else if (role === 'admin') {
      navLinks = `
        <a href="/admin/dashboard" data-link>${t('admin.dashboard')}</a>
        <a href="/admin/bookings" data-link>${t('header.bookings')}</a>
        <a href="/admin/properties" data-link>${t('header.properties')}</a>
        <a href="/admin/users" data-link>${t('header.hosts')}</a>
        <div class="nav-dropdown">
          <button type="button" class="nav-bell" data-action="toggleNotifBell" aria-label="${t('header.notifications')}">
            🔔<span class="nav-bell-label">${t('header.notifications')}</span><span class="notif-badge" id="notif-badge" style="display:none;">0</span>
          </button>
          <div class="nav-dropdown-menu notif-menu" id="notif-menu">
            <p class="loading">${t('common.loading')}</p>
          </div>
        </div>
        <div class="nav-dropdown">
          <button type="button" class="nav-dropdown-toggle" data-action="toggleNavDropdown">${t('header.more')} ▾</button>
          <div class="nav-dropdown-menu">
            <a href="/admin/availability" data-link>${t('header.availability')}</a>
            <a href="/admin/orphaned-payments" data-link>${t('header.orphanedPayments')}</a>
            <a href="/admin/host-commissions" data-link>${t('header.hostCommissions')}</a>
            ${experiencesEnabled ? `
              <a href="/admin/organizers" data-link>${t('header.organizers')}</a>
              <a href="/admin/experiences" data-link>${t('header.pendingExperiences')}</a>
              <a href="/admin/experience-bookings" data-link>${t('header.experienceBookings')}</a>
              <a href="/admin/organizer-commissions" data-link>${t('header.organizerCommissions')}</a>
            ` : ''}
            <a href="/admin/password-resets" data-link>${t('header.passwordResets')}</a>
            <a href="/admin/places" data-link>${t('header.places')}</a>
            <a href="/admin/audit-log" data-link>${t('header.auditLog')}</a>
            <a href="/admin/feedback" data-link>${t('nav.feedback')}</a>
            <a href="/admin/reports" data-link>${t('nav.reports')}</a>
            <a href="/admin/settings" data-link>${t('nav.settings')}</a>
          </div>
        </div>
        <button data-action="logout" class="btn btn-outline">${t('common.logout')}</button>
      `;
    }

    return `
      <header class="header">
        <div class="container">
          <div class="header-left">
            <button type="button" class="nav-back-btn" data-action="historyBack" aria-label="${t('common.back')}" title="${t('common.back')}">
              ←
            </button>
            <a href="/" data-link class="logo">
              <img src="/assets/logo-elysio.svg" alt="Elysio Experiences" class="logo-img">
            </a>
          </div>
          <nav class="nav" id="site-nav">
            ${navLinks}
            <select class="lang-select" data-change-action="changeLang" aria-label="${t('common.language')}">
              ${langOptions}
            </select>
            <button type="button" class="theme-toggle" data-action="toggleTheme" aria-label="${t(isDarkTheme() ? 'common.themeToLight' : 'common.themeToDark')}" title="${t(isDarkTheme() ? 'common.themeToLight' : 'common.themeToDark')}">
              ${isDarkTheme() ? SUN_ICON : MOON_ICON}
            </button>
          </nav>
          <button type="button" class="mobile-menu-btn" data-action="toggleMobileMenu" aria-controls="mobile-drawer" aria-expanded="false" aria-label="${t('header.menu')}">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>
      ${drawerHtml({ role: isLoggedIn ? role : null, user, t, experiencesEnabled })}
    `;
  },

  init() {
    const headerEl = document.getElementById('header');
    if (headerEl) {
      // Cambiar idioma o tema vuelve a pintar el encabezado: si el menu
      // estaba abierto, sigue abierto (sin animacion).
      const wasOpen = document.body.classList.contains('menu-open');
      headerEl.innerHTML = this.render();
      markCurrentLink(headerEl);
      setMobileMenu(wasOpen, { instant: true });

      const header = headerEl.querySelector('.header');
      if (header) {
        const onScroll = () => {
          header.classList.toggle('scrolled', window.scrollY > 10);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
      }

      if (auth.isLoggedIn() && auth.isAdmin()) {
        loadPendingCounts();
      }
    }
  }
};

// Tema efectivo: el elegido (data-theme) o, si no hay, el del sistema.
function isDarkTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
}

window.toggleTheme = function () {
  const next = isDarkTheme() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Sin localStorage el cambio dura solo esta visita.
  }
  Header.init();
};

window.changeLang = function (lang) {
  const currentPath = window.location.pathname;
  const strippedPath = i18n.stripLocaleFromPath(currentPath);
  if (i18n.isLocalizablePath(strippedPath)) {
    // Primero se guarda el idioma: el ingles va sin prefijo y, si no, el
    // router veria "/" con es/fr guardado y volveria a llevar a /es o /fr.
    i18n.setLang(lang);
    router.navigateRaw(i18n.localizePath(currentPath, lang));
  } else {
    i18n.setLang(lang);
    window.rerenderCurrentPage();
  }
};

// Marca el enlace de la pagina actual (en el menu movil se resalta).
function markCurrentLink(root) {
  const path = i18n.stripLocaleFromPath(window.location.pathname);
  root.querySelectorAll('.nav a[data-link], .drawer a[data-link]').forEach((a) => {
    if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page');
  });
}

// Menu movil: el boton lo abre; se cierra con la X, al tocar un enlace (sin
// esperar a que cargue la pagina), fuera del panel o con Escape.
function setMobileMenu(open, { instant = false } = {}) {
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.querySelector('.drawer-backdrop');
  const btn = document.querySelector('.mobile-menu-btn');
  if (!drawer || !backdrop || !btn) return;
  btn.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
  drawer.classList.toggle('no-anim', instant);
  if (open) {
    drawer.hidden = false;
    backdrop.hidden = false;
    // Un fotograma con el panel fuera de la pantalla para que entre deslizandose.
    requestAnimationFrame(() => {
      drawer.classList.add('open');
      backdrop.classList.add('open');
    });
    if (!instant) drawer.querySelector('.drawer-close')?.focus({ preventScroll: true });
  } else {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.hidden = true;
    backdrop.hidden = true;
  }
}

window.toggleMobileMenu = function () {
  setMobileMenu(!document.body.classList.contains('menu-open'));
};

window.closeMobileMenu = function () {
  setMobileMenu(false);
  document.querySelector('.mobile-menu-btn')?.focus();
};

// Abre o cierra una seccion del menu movil (Mas, Notificaciones).
window.toggleDrawerSection = function () {
  const panel = document.getElementById(this.getAttribute('aria-controls'));
  if (!panel) return;
  const open = this.getAttribute('aria-expanded') !== 'true';
  this.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;
  if (open && this.getAttribute('aria-controls') === 'drawer-notif') loadPendingCounts();
};

document.addEventListener('click', (event) => {
  if (!document.body.classList.contains('menu-open')) return;
  if (event.target.closest('.drawer a[href], .drawer-backdrop')) setMobileMenu(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) window.closeMobileMenu();
});

window.toggleNavDropdown = function () {
  // `this` es el boton (eventos delegados desde app.js, ver data-action).
  const menu = this.nextElementSibling;
  const wasOpen = menu.classList.contains('open');
  document.querySelectorAll('.nav-dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  if (!wasOpen) menu.classList.add('open');
};

// Cierra los menus al hacer clic fuera. Los botones que los abren se ignoran:
// su propia accion decide si abrir o cerrar.
document.addEventListener('click', (event) => {
  if (event.target.closest('.nav-dropdown-toggle, .nav-bell')) return;
  document.querySelectorAll('.nav-dropdown-menu.open').forEach((m) => m.classList.remove('open'));
});

// Clave i18n (header.notif.<clave>) y destino de cada contador pendiente.
const notifUrls = {
  bookings: '/admin/bookings',
  properties: '/admin/properties',
  password_resets: '/admin/password-resets',
  orphaned_payments: '/admin/orphaned-payments',
  overdue_commissions: '/admin/host-commissions',
  pending_experiences: '/admin/experiences',
  pending_experience_bookings: '/admin/experience-bookings',
  overdue_organizer_commissions: '/admin/organizer-commissions',
  manual_payments_pending: '/admin/bookings',
};

async function loadPendingCounts() {
  const badge = document.getElementById('notif-badge');
  const menu = document.getElementById('notif-menu');
  if (!badge || !menu) return;

  try {
    const response = await api.get('/admin/pending-counts');
    const counts = response.data || {};

    if (counts.total > 0) {
      badge.textContent = counts.total > 99 ? '99+' : counts.total;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }

    const items = Object.entries(notifUrls)
      .filter(([key]) => counts[key] > 0)
      .map(([key, url]) => `<a href="${escapeHtml(url)}" data-link>${escapeHtml(i18n.t(`header.notif.${key}`))} <strong>(${counts[key]})</strong></a>`)
      .join('');

    const { subscribed } = await syncAdminPushSubscription();
    const subscribeRow = !subscribed
      ? `<button type="button" class="notif-enable-btn" data-action="enableAdminPush">🔔 ${i18n.t('header.enablePush')}</button>`
      : '';

    menu.innerHTML = (items || `<p class="no-results" style="padding:8px 12px;">${i18n.t('header.nothingPending')}</p>`) + subscribeRow;

    // Lo mismo en el menu del movil: contadores en sus filas y la lista.
    document.querySelectorAll('.drawer-badge[data-count]').forEach((el) => {
      const n = counts[el.dataset.count] || 0;
      el.textContent = n > 99 ? '99+' : n;
      el.hidden = n === 0;
    });
    const drawerNotif = document.getElementById('drawer-notif');
    if (drawerNotif) {
      drawerNotif.innerHTML = (items || `<p class="drawer-sub-note">${i18n.t('header.nothingPending')}</p>`) + subscribeRow;
    }
  } catch (error) {
    menu.innerHTML = `<p class="error" style="padding:8px 12px;">${i18n.t('header.notifError')}</p>`;
  }
}

window.toggleNotifBell = function () {
  const menu = document.getElementById('notif-menu');
  const wasOpen = menu.classList.contains('open');
  document.querySelectorAll('.nav-dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  if (!wasOpen) {
    menu.classList.add('open');
    loadPendingCounts();
  }
};

window.enableAdminPush = async function () {
  const result = await subscribeAdminToPush();
  if (result.ok) {
    alert(i18n.t('header.pushEnabled'));
    loadPendingCounts();
  } else if (result.reason === 'denied') {
    alert(i18n.t('header.pushDenied'));
  } else if (result.reason === 'unsupported') {
    alert(i18n.t('header.pushUnsupported'));
  } else {
    alert(i18n.t('header.pushFailed'));
  }
};

window.addEventListener('langChanged', () => {
  Header.init();
});

// Sin tema elegido, el icono sigue al sistema si este cambia.
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (!document.documentElement.dataset.theme) Header.init();
});

export default Header;
