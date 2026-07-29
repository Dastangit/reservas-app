import auth from '../auth.js';
import i18n from '../i18n.js';
import api from '../api.js';
import { subscribeAdminToPush, isAdminPushSubscribed } from '../utils/adminPush.js';

const Header = {
  render() {
    const isLoggedIn = auth.isLoggedIn();
    const role = auth.getRole();
    const user = auth.getUser();
    const t = (key) => i18n.t(key);

    const langOptions = i18n.getLangs().map((lang) =>
      `<option value="${lang.code}" ${lang.code === i18n.currentLang ? 'selected' : ''}>${lang.label}</option>`
    ).join('');

    let navLinks = '';

    if (!isLoggedIn) {
      navLinks = `
        <a href="/" data-link>${t('common.home')}</a>
        <a href="/login" data-link class="btn btn-outline">${t('common.login')}</a>
        <a href="/register" data-link class="btn btn-primary">${t('common.register')}</a>
      `;
    } else if (role === 'tourist') {
      navLinks = `
        <a href="/" data-link>${t('common.home')}</a>
        <a href="/search" data-link>${t('common.search')}</a>
        <a href="/dashboard" data-link>${t('nav.myBookings')}</a>
        <a href="/profile" data-link class="nav-user">${user?.name || t('common.profile')}</a>
        <button onclick="logout()" class="btn btn-outline">${t('common.logout')}</button>
      `;
    } else if (role === 'host') {
      navLinks = `
        <a href="/host/dashboard" data-link>${t('host.dashboard')}</a>
        <a href="/host/properties" data-link>${t('host.myProperties')}</a>
        <a href="/host/bookings" data-link>${t('nav.myBookings')}</a>
        <a href="/host/earnings" data-link>${t('host.earnings')}</a>
        <a href="/host/profile" data-link class="nav-user">${user?.name || t('common.profile')}</a>
        <button onclick="logout()" class="btn btn-outline">${t('common.logout')}</button>
      `;
    } else if (role === 'admin') {
      navLinks = `
        <a href="/admin/dashboard" data-link>${t('admin.dashboard')}</a>
        <a href="/admin/bookings" data-link>${t('nav.myBookings')}</a>
        <a href="/admin/properties" data-link>${t('host.myProperties')}</a>
        <a href="/admin/users" data-link>Users</a>
        <div class="nav-dropdown">
          <button type="button" class="nav-bell" onclick="toggleNotifBell(event)" aria-label="Notificaciones">
            🔔<span class="notif-badge" id="notif-badge" style="display:none;">0</span>
          </button>
          <div class="nav-dropdown-menu notif-menu" id="notif-menu">
            <p class="loading">Cargando...</p>
          </div>
        </div>
        <div class="nav-dropdown">
          <button type="button" class="nav-dropdown-toggle" onclick="toggleNavDropdown(event)">Más ▾</button>
          <div class="nav-dropdown-menu">
            <a href="/admin/availability" data-link>Disponibilidad</a>
            <a href="/admin/orphaned-payments" data-link>Pagos huérfanos</a>
            <a href="/admin/host-commissions" data-link>Comisiones hosts</a>
            <a href="/admin/password-resets" data-link>Reset contraseñas</a>
            <a href="/admin/feedback" data-link>${t('nav.feedback')}</a>
            <a href="/admin/reports" data-link>${t('nav.reports')}</a>
            <a href="/admin/settings" data-link>${t('nav.settings')}</a>
          </div>
        </div>
        <button onclick="logout()" class="btn btn-outline">${t('common.logout')}</button>
      `;
    }

    return `
      <header class="header">
        <div class="container">
          <a href="/" data-link class="logo">
            <img src="/assets/logo.png" alt="Da-El World Travelers" class="logo-img">
          </a>
          <nav class="nav">
            ${navLinks}
            <select class="lang-select" onchange="changeLang(this.value)">
              ${langOptions}
            </select>
          </nav>
          <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
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

window.changeLang = function (lang) {
  i18n.setLang(lang);
  window.rerenderCurrentPage();
};

window.toggleNavDropdown = function (event) {
  event.stopPropagation();
  const menu = event.currentTarget.nextElementSibling;
  const wasOpen = menu.classList.contains('open');
  document.querySelectorAll('.nav-dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  if (!wasOpen) menu.classList.add('open');
};

document.addEventListener('click', () => {
  document.querySelectorAll('.nav-dropdown-menu.open').forEach((m) => m.classList.remove('open'));
});

const notifLabels = {
  bookings: { label: 'Reservas pendientes', url: '/admin/bookings' },
  properties: { label: 'Propiedades pendientes', url: '/admin/properties' },
  password_resets: { label: 'Resets de contraseña', url: '/admin/password-resets' },
  orphaned_payments: { label: 'Pagos huérfanos', url: '/admin/orphaned-payments' },
  overdue_commissions: { label: 'Comisiones vencidas', url: '/admin/host-commissions' },
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

    const items = Object.entries(notifLabels)
      .filter(([key]) => counts[key] > 0)
      .map(([key, meta]) => `<a href="${meta.url}" data-link>${meta.label} <strong>(${counts[key]})</strong></a>`)
      .join('');

    const subscribeRow = !isAdminPushSubscribed()
      ? '<button type="button" class="notif-enable-btn" onclick="enableAdminPush()">🔔 Activar notificaciones push</button>'
      : '';

    menu.innerHTML = (items || '<p class="no-results" style="padding:8px 12px;">Nada pendiente por ahora.</p>') + subscribeRow;
  } catch (error) {
    menu.innerHTML = '<p class="error" style="padding:8px 12px;">Error cargando notificaciones</p>';
  }
}

window.toggleNotifBell = function (event) {
  event.stopPropagation();
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
    alert('¡Notificaciones activadas! Recibirás un aviso cuando algo necesite tu atención.');
    loadPendingCounts();
  } else if (result.reason === 'denied') {
    alert('Bloqueaste el permiso de notificaciones. Actívalo desde la configuración del navegador si cambias de opinión.');
  } else if (result.reason === 'unsupported') {
    alert('Tu navegador no soporta notificaciones push.');
  } else {
    alert('No se pudo activar la notificación, intenta de nuevo.');
  }
};

window.addEventListener('langChanged', () => {
  Header.init();
});

export default Header;
