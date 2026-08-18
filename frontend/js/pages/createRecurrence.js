import api from '../api.js';
import auth from '../auth.js';

const DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

const CreateRecurrencePage = {
  images: [],

  async render() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como organizador.</p></div>';
    }

    return `
      <div class="publish-property-page">
        <div class="container">
          <h1>Nueva excursión recurrente</h1>
          <p style="color:var(--text-light);">Ej: "Tour a Viñales, todos los sábados". Cada ocurrencia se aprueba individualmente por el admin.</p>

          <form id="recurrence-form">
            <div class="form-section">
              <h2>Información básica</h2>

              <div class="form-group">
                <label>Título</label>
                <input type="text" id="rec-title" required>
              </div>

              <div class="form-group">
                <label>Descripción</label>
                <textarea id="rec-description" rows="4" required></textarea>
              </div>

              <div class="form-group">
                <label>Categoría</label>
                <input type="text" id="rec-category" placeholder="ej: tour, senderismo">
              </div>

              <div class="form-group">
                <label>Ciudad</label>
                <input type="text" id="rec-city" required>
              </div>

              <div class="form-group">
                <label>Duración (horas)</label>
                <input type="number" id="rec-duration" min="0">
              </div>

              <div class="form-group">
                <label>Cupos máximos por ocurrencia</label>
                <input type="number" id="rec-max-participants" min="1" required>
              </div>
            </div>

            <div class="form-section">
              <h2>Frecuencia</h2>

              <div class="form-group">
                <label>Días de la semana</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  ${DAYS.map((d) => `
                    <label style="display:flex;align-items:center;gap:4px;">
                      <input type="checkbox" class="rec-day" value="${d.value}"> ${d.label}
                    </label>
                  `).join('')}
                </div>
              </div>

              <div class="form-group">
                <label>Hora</label>
                <input type="time" id="rec-time" value="09:00" required>
              </div>

              <div class="form-group">
                <label>Fecha de inicio</label>
                <input type="date" id="rec-start-date" required>
              </div>

              <div class="form-group">
                <label>Fecha de fin (opcional -- vacío = indefinido)</label>
                <input type="date" id="rec-end-date">
              </div>
            </div>

            <div class="form-section">
              <h2>Precios</h2>
              <div id="pricing-rows">
                <div class="form-group pricing-row" style="display:flex;gap:10px;align-items:end;">
                  <div style="flex:1;">
                    <label>Audiencia</label>
                    <select class="pricing-audience">
                      <option value="tourist">Turista</option>
                      <option value="local">Residente en Cuba</option>
                    </select>
                  </div>
                  <div style="flex:1;">
                    <label>Moneda</label>
                    <select class="pricing-currency">
                      <option value="USD">USD</option>
                      <option value="USDT">USDT</option>
                      <option value="CUP">CUP</option>
                    </select>
                  </div>
                  <div style="flex:1;">
                    <label>Precio por cupo</label>
                    <input type="number" class="pricing-amount" min="0" step="0.01" required>
                  </div>
                  <button type="button" class="btn btn-danger btn-sm remove-pricing-row" style="display:none;">X</button>
                </div>
              </div>
              <button type="button" id="add-pricing-btn" class="btn btn-outline btn-sm">+ Agregar precio</button>
            </div>

            <div class="form-section">
              <h2>Mezcla de audiencias</h2>
              <label style="display:flex;align-items:flex-start;gap:8px;">
                <input type="checkbox" id="rec-mixed-audience" style="margin-top:4px;">
                <span>
                  Esta serie admite reservas mixtas de residentes en Cuba y turistas juntos.
                  <br><strong style="color:var(--danger, #c0392b);">Solo marca esta opción si tienes el permiso legal vigente del gobierno cubano para hacerlo.</strong>
                  El admin lo revisa en cada ocurrencia que apruebe.
                </span>
              </label>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary btn-block">Crear serie recurrente</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    document.getElementById('add-pricing-btn')?.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'form-group pricing-row';
      row.style.cssText = 'display:flex;gap:10px;align-items:end;';
      row.innerHTML = `
        <div style="flex:1;"><label>Audiencia</label>
          <select class="pricing-audience"><option value="tourist">Turista</option><option value="local">Residente en Cuba</option></select>
        </div>
        <div style="flex:1;"><label>Moneda</label>
          <select class="pricing-currency"><option value="USD">USD</option><option value="USDT">USDT</option><option value="CUP">CUP</option></select>
        </div>
        <div style="flex:1;"><label>Precio por cupo</label><input type="number" class="pricing-amount" min="0" step="0.01" required></div>
        <button type="button" class="btn btn-danger btn-sm remove-pricing-row">X</button>
      `;
      document.getElementById('pricing-rows').appendChild(row);
      this.bindRemove();
    });
    this.bindRemove();

    document.getElementById('recurrence-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  },

  bindRemove() {
    document.querySelectorAll('.remove-pricing-row').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => btn.closest('.pricing-row').remove());
    });
  },

  async handleSubmit() {
    const errorEl = document.getElementById('error-message');

    const days_of_week = Array.from(document.querySelectorAll('.rec-day:checked')).map((c) => Number(c.value));
    if (days_of_week.length === 0) {
      errorEl.textContent = 'Selecciona al menos un día de la semana';
      errorEl.style.display = 'block';
      return;
    }

    const pricing = Array.from(document.querySelectorAll('.pricing-row')).map((row) => ({
      audience: row.querySelector('.pricing-audience').value,
      currency: row.querySelector('.pricing-currency').value,
      amount: parseFloat(row.querySelector('.pricing-amount').value),
    }));

    if (pricing.some((p) => Number.isNaN(p.amount))) {
      errorEl.textContent = 'Revisa los precios ingresados';
      errorEl.style.display = 'block';
      return;
    }

    const payload = {
      title: document.getElementById('rec-title').value,
      description: document.getElementById('rec-description').value,
      category: document.getElementById('rec-category').value,
      location: { city: document.getElementById('rec-city').value },
      duration_hours: Number(document.getElementById('rec-duration').value) || undefined,
      max_participants: Number(document.getElementById('rec-max-participants').value),
      pricing,
      allows_mixed_audience: document.getElementById('rec-mixed-audience').checked,
      recurrence: {
        days_of_week,
        time_of_day: document.getElementById('rec-time').value,
        start_date: document.getElementById('rec-start-date').value,
        end_date: document.getElementById('rec-end-date').value || undefined,
      },
    };

    try {
      const response = await api.post('/organizer/recurrences', payload);
      alert(`Serie creada. Se generaron ${response.data.occurrences_generated} ocurrencias, cada una pendiente de aprobación del admin.`);
      window.location.href = '/organizer/recurrences';
    } catch (error) {
      errorEl.textContent = error.message || 'No se pudo crear la serie recurrente';
      errorEl.style.display = 'block';
    }
  },
};

export default CreateRecurrencePage;
