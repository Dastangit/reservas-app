import auth from '../auth.js';
import i18n from '../i18n.js';
import AvailabilityCalendar from '../components/AvailabilityCalendar.js';

const CalendarAvailabilityPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isHost()) {
      return `<div class="container"><p>${t('host.accessDenied')}</p></div>`;
    }

    const pathParts = window.location.pathname.split('/');
    const propertyId = pathParts[3]; // /host/properties/:id/calendar

    if (!propertyId) {
      return `<div class="container"><p class="error">${t('host.noPropertySpecified')}</p></div>`;
    }

    return `
      <div class="calendar-page">
        <div class="container">
          <h1>${t('host.manageAvailability')}</h1>
          <p class="subtitle">${t('host.manageAvailabilitySubtitle')}</p>
          <div id="calendar-root"></div>
        </div>
      </div>
    `;
  },

  init() {
    const pathParts = window.location.pathname.split('/');
    const propertyId = pathParts[3];
    if (!propertyId) return;

    AvailabilityCalendar.mount('#calendar-root', { propertyId, mode: 'host' });
  },
};

export default CalendarAvailabilityPage;
