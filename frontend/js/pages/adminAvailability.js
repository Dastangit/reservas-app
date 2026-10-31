import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import AvailabilityCalendar from '../components/AvailabilityCalendar.js';
import { escapeHtml } from '../utils/escape.js';

const t = (key) => i18n.t(key);

const AdminAvailabilityPage = {
  async render() {
    if (!auth.isLoggedIn() || auth.getRole() !== 'admin') {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-availability-page">
        <div class="container">
          <h1>${t('adminAvailability.title')}</h1>
          <p class="subtitle">${t('adminAvailability.subtitle')}</p>

          <div class="form-group avail-property-select">
            <label for="admin-property-select">${t('adminAvailability.selectLabel')}</label>
            <select id="admin-property-select">
              <option value="">${t('common.loading')}</option>
            </select>
          </div>

          <div id="calendar-root"></div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || auth.getRole() !== 'admin') return;

    const select = document.getElementById('admin-property-select');

    try {
      // El backend devuelve como maximo 100 por pagina.
      const response = await api.get('/admin/properties?limit=100');
      const properties = response.data?.properties || [];

      if (properties.length === 0) {
        select.innerHTML = `<option value="">${t('adminAvailability.noProperties')}</option>`;
        return;
      }

      select.innerHTML = `
        <option value="">${t('adminAvailability.choose')}</option>
        ${properties.map((p) => `<option value="${p._id}">${escapeHtml(p.name)} (${escapeHtml(p.host_id?.name || t('adminAvailability.noHost'))})</option>`).join('')}
      `;

      select.addEventListener('change', () => {
        const propertyId = select.value;
        const root = document.getElementById('calendar-root');
        if (!propertyId) {
          root.innerHTML = '';
          return;
        }
        AvailabilityCalendar.mount('#calendar-root', { propertyId, mode: 'admin' });
      });
    } catch (error) {
      select.innerHTML = `<option value="">${t('adminAvailability.loadError')}</option>`;
    }
  },
};

export default AdminAvailabilityPage;
