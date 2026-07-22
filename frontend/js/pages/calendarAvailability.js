import auth from '../auth.js';
import AvailabilityCalendar from '../components/AvailabilityCalendar.js';

const CalendarAvailabilityPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isHost()) {
      return '<div class="container"><p>Access denied. Please login as a host.</p></div>';
    }

    const pathParts = window.location.pathname.split('/');
    const propertyId = pathParts[3]; // /host/properties/:id/calendar

    if (!propertyId) {
      return '<div class="container"><p class="error">No se especificó una propiedad.</p></div>';
    }

    return `
      <div class="calendar-page">
        <div class="container">
          <h1>Gestionar Disponibilidad</h1>
          <p class="subtitle">Bloquea fechas cuando recibas reservas fuera de la plataforma.</p>
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
