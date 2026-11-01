import auth from '../auth.js';
import i18n from '../i18n.js';
import api from '../api.js';
import { subscribeAdminToPush, syncAdminPushSubscription } from '../utils/adminPush.js';
import router from '../router.js';
import { escapeHtml } from '../utils/escape.js';

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
            🔔<span class="notif-badge" id="notif-badge" style="display:none;">0</span>
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
          <nav class="nav">
            ${navLinks}
            <select class="lang-select" data-change-action="changeLang">
              ${langOptions}
            </select>
            <button type="button" class="theme-toggle" data-action="toggleTheme" aria-label="${t(isDarkTheme() ? 'common.themeToLight' : 'common.themeToDark')}" title="${t(isDarkTheme() ? 'common.themeToLight' : 'common.themeToDark')}">
              ${isDarkTheme() ? '☀' : '☾'}
            </button>
          </nav>
          <button class="mobile-menu-btn" data-action="toggleMobileMenu">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>
    `;
  },

  init() {
    const headerEl = document.getElementById('header');
    if (headerEl) {
      headerEl.innerHTML = this.render();

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
    router.navigateRaw(i18n.localizePath(currentPath, lang));
  } else {
    i18n.setLang(lang);
    window.rerenderCurrentPage();
  }
};

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
