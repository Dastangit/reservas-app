import api from '../api.js';
import auth from '../auth.js';
import AvailabilityCalendar from '../components/AvailabilityCalendar.js';

const AdminAvailabilityPage = {
  async render() {
    if (!auth.isLoggedIn() || auth.getRole() !== 'admin') {
      return '<div class="container"><p>Access denied.</p></div>';
    }

    return `
      <div class="admin-availability-page">
        <div class="container">
          <h1>Disponibilidad de Propiedades</h1>
          <p class="subtitle">Consulta y edita el calendario de disponibilidad de cualquier propiedad.</p>

          <div class="form-group avail-property-select">
            <label>Selecciona una propiedad</label>
            <select id="admin-property-select">
              <option value="">Cargando propiedades...</option>
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
      const response = await api.get('/admin/properties?limit=200');
      const properties = response.data?.properties || [];

      if (properties.length === 0) {
        select.innerHTML = '<option value="">No hay propiedades</option>';
        return;
      }

      select.innerHTML = `
        <option value="">-- Selecciona --</option>
        ${properties.map((p) => `<option value="${p._id}">${p.name} (${p.host_id?.name || 'sin host'})</option>`).join('')}
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
      select.innerHTML = '<option value="">Error cargando propiedades</option>';
    }
  },
};

export default AdminAvailabilityPage;
