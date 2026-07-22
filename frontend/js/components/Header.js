import auth from '../auth.js';
import i18n from '../i18n.js';

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
        <a href="/admin/availability" data-link>Disponibilidad</a>
        <a href="/admin/orphaned-payments" data-link>Pagos huérfanos</a>
        <a href="/admin/host-commissions" data-link>Comisiones hosts</a>
        <a href="/admin/feedback" data-link>${t('nav.feedback')}</a>
        <a href="/admin/users" data-link>Users</a>
        <a href="/admin/reports" data-link>${t('nav.reports')}</a>
        <a href="/admin/settings" data-link>${t('nav.settings')}</a>
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
    }
  }
};

window.changeLang = function (lang) {
  i18n.setLang(lang);
  window.rerenderCurrentPage();
};

window.addEventListener('langChanged', () => {
  Header.init();
});

export default Header;
