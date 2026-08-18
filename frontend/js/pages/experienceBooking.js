import api from '../api.js';
import auth from '../auth.js';
import { formatExperiencePrice } from '../utils/formatters.js';
import { validateInternationalPhone } from '../utils/validators.js';

const ExperienceBookingPage = {
  experience: null,

  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Por favor <a href="/login" data-link>inicia sesión</a> para reservar.</p></div>';
    }

    const id = this._params?.id || window.location.pathname.split('/')[2];

    try {
      const response = await api.get(`/experiences/${id}`);
      this.experience = response.data?.experience;
      this.spotsAvailable = response.data?.spots_available ?? 0;
    } catch (error) {
      return '<div class="container"><p class="error">Excursión no encontrada</p></div>';
    }

    if (!this.experience) {
      return '<div class="container"><p class="error">Excursión no encontrada</p></div>';
    }

    const exp = this.experience;
    const pricingOptions = (exp.pricing || []).map((p) =>
      `<option value="${p.audience}|${p.currency}">${p.audience === 'local' ? 'Residente en Cuba' : 'Turista'} -- ${formatExperiencePrice(p.amount, p.currency)}/cupo</option>`
    ).join('');

    return `
      <div class="booking-form-page">
        <div class="container">
          <h1>Reservar: ${exp.title}</h1>

          <div class="booking-layout">
            <div class="booking-details">
              <div class="property-summary">
                <img src="${exp.images?.[0]?.url || 'https://via.placeholder.com/100'}" alt="${exp.title}">
                <div>
                  <h3>${exp.title}</h3>
                  <p>${exp.location?.city || ''} · ${new Date(exp.date).toLocaleDateString()}</p>
                </div>
              </div>

              <p style="margin:15px 0;color:var(--text-light);">
                ${this.spotsAvailable} cupos disponibles.
                ${exp.allows_mixed_audience ? ' Esta excursión admite grupos con locales y turistas juntos.' : ''}
              </p>

              <div id="spots-rows">
                <div class="form-group spots-row" style="display:flex;gap:10px;align-items:end;">
                  <div style="flex:2;">
                    <label>Tipo de cupo</label>
                    <select class="spots-audience-currency" required>
                      ${pricingOptions}
                    </select>
                  </div>
                  <div style="flex:1;">
                    <label>Cantidad</label>
                    <input type="number" class="spots-count" min="1" value="1" required>
                  </div>
                  ${exp.allows_mixed_audience ? '<button type="button" class="btn btn-danger btn-sm remove-spots-row" style="display:none;">X</button>' : ''}
                </div>
              </div>

              ${exp.allows_mixed_audience ? `
                <button type="button" id="add-spots-row-btn" class="btn btn-outline btn-sm" style="margin-top:10px;">+ Agregar otro tipo de cupo</button>
              ` : ''}
            </div>

            <div class="booking-form-sidebar">
              <form id="experience-booking-form">
                <h3>Tu información</h3>

                <div class="form-group">
                  <label>Nombre</label>
                  <input type="text" id="tourist-name" value="${auth.getUser()?.name || ''}" required>
                </div>

                <div class="form-group">
                  <label>Email</label>
                  <input type="email" id="tourist-email" required>
                </div>

                <div class="form-group">
                  <label>Teléfono (WhatsApp) *</label>
                  <input type="tel" id="tourist-phone" placeholder="+53 5xxxxxxx" required>
                  <small class="field-hint">Incluye el código de país, ej. +53, +1, +34</small>
                </div>

                <div class="form-group">
                  <label>Contacto preferido</label>
                  <select id="contact-method">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>
                </div>

                <div id="error-message" class="error-message" style="display:none;"></div>

                <button type="submit" class="btn btn-primary btn-block">Reservar cupos</button>

                <p class="fee-notice">
                  * No se cobra nada por reservar. El pago del servicio se coordina directo con el organizador.
                  Tu reserva queda pendiente de aprobación del admin (hasta 24h).
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const addBtn = document.getElementById('add-spots-row-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addSpotsRow());
    }

    this.attachRemoveHandlers();

    const form = document.getElementById('experience-booking-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleBooking();
      });
    }
  },

  addSpotsRow() {
    const container = document.getElementById('spots-rows');
    const pricingOptions = (this.experience.pricing || []).map((p) =>
      `<option value="${p.audience}|${p.currency}">${p.audience === 'local' ? 'Residente en Cuba' : 'Turista'}</option>`
    ).join('');

    const div = document.createElement('div');
    div.className = 'form-group spots-row';
    div.style.cssText = 'display:flex;gap:10px;align-items:end;';
    div.innerHTML = `
      <div style="flex:2;">
        <label>Tipo de cupo</label>
        <select class="spots-audience-currency" required>${pricingOptions}</select>
      </div>
      <div style="flex:1;">
        <label>Cantidad</label>
        <input type="number" class="spots-count" min="1" value="1" required>
      </div>
      <button type="button" class="btn btn-danger btn-sm remove-spots-row">X</button>
    `;
    container.appendChild(div);
    this.attachRemoveHandlers();
  },

  attachRemoveHandlers() {
    document.querySelectorAll('.remove-spots-row').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => btn.closest('.spots-row').remove());
    });
  },

  async handleBooking() {
    const errorEl = document.getElementById('error-message');

    const phone = document.getElementById('tourist-phone')?.value?.trim();
    if (!validateInternationalPhone(phone)) {
      errorEl.textContent = 'Ingresa un teléfono válido con código de país (ej. +5355512345)';
      errorEl.style.display = 'block';
      return;
    }

    const payment_info = Array.from(document.querySelectorAll('.spots-row')).map((row) => {
      const [audience, currency] = row.querySelector('.spots-audience-currency').value.split('|');
      const num_spots = parseInt(row.querySelector('.spots-count').value, 10);
      return { audience, currency, num_spots };
    });

    if (payment_info.length === 0 || payment_info.some((p) => !p.num_spots || p.num_spots < 1)) {
      errorEl.textContent = 'Revisa la cantidad de cupos';
      errorEl.style.display = 'block';
      return;
    }

    const bookingData = {
      payment_info,
      tourist_data: {
        name: document.getElementById('tourist-name')?.value,
        email: document.getElementById('tourist-email')?.value,
        phone,
        contact_method: document.getElementById('contact-method')?.value,
        language: window.i18n?.currentLang || 'es',
      },
    };

    try {
      const response = await api.post(`/experiences/${this.experience._id}/book`, bookingData);

      if (response.success) {
        window.location.href = `/experience-bookings/${response.data.booking_id}/confirmation`;
      }
    } catch (error) {
      if (error.message === 'NOT_ENOUGH_SPOTS' || /cupos/i.test(error.message || '')) {
        errorEl.innerHTML = `No hay suficientes cupos disponibles. <a href="/experiences/${this.experience._id}" data-link>Volver a la excursión</a> para unirte a la lista de espera.`;
      } else {
        errorEl.textContent = error.message || 'No se pudo completar la reserva';
      }
      errorEl.style.display = 'block';
    }
  },
};

export default ExperienceBookingPage;
