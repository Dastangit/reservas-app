import api from '../api.js';

// Componente de calendario de disponibilidad reutilizable.
// Uso: AvailabilityCalendar.mount('#calendar-root', { propertyId, mode: 'host' | 'admin' })
//
// mode 'host'   -> usa /properties/:id/availability/...
// mode 'admin'  -> usa /admin/properties/:id/availability/...

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateOnly(d) {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const AvailabilityCalendar = {
  _state: {},

  basePath(mode, propertyId) {
    return mode === 'admin'
      ? `/admin/properties/${propertyId}`
      : `/properties/${propertyId}`;
  },

  async mount(containerSelector, { propertyId, mode = 'host' }) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    this._state = {
      containerSelector,
      propertyId,
      mode,
      selectionStart: null,
      blockedDates: [],
      bookings: [],
      error: null,
    };

    container.innerHTML = '<p class="loading">Cargando disponibilidad...</p>';
    await this.loadAndRender();
  },

  async loadAndRender() {
    const { propertyId, mode } = this._state;
    const today = dateOnly(new Date());
    const rangeEnd = new Date(today);
    rangeEnd.setMonth(rangeEnd.getMonth() + 2); // hoy -> mes actual + 1 mes completo

    try {
      const response = await api.get(
        `${this.basePath(mode, propertyId)}/availability/calendar?from=${toISODate(today)}&to=${toISODate(rangeEnd)}`,
      );
      this._state.blockedDates = response.data?.blocked_dates || [];
      this._state.bookings = response.data?.bookings || [];
      this._state.error = null;
    } catch (error) {
      this._state.error = 'No se pudo cargar la disponibilidad.';
    }

    this.render();
  },

  dayStatus(date) {
    const { blockedDates, bookings } = this._state;

    for (const b of bookings) {
      if (date >= dateOnly(b.check_in) && date < dateOnly(b.check_out)) {
        return { status: 'reserved' };
      }
    }
    for (const bd of blockedDates) {
      if (date >= dateOnly(bd.start_date) && date < dateOnly(bd.end_date)) {
        return { status: bd.blocked_by === 'admin' ? 'blocked-admin' : 'blocked-host', block: bd };
      }
    }
    return { status: 'free' };
  },

  renderMonth(year, month, today, maxDate) {
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const { selectionStart } = this._state;

    let cells = '';
    for (let i = 0; i < startWeekday; i++) {
      cells += '<div class="avail-day avail-day-empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const iso = toISODate(date);
      const outOfRange = date < today || date > maxDate;
      const { status } = outOfRange ? { status: 'out' } : this.dayStatus(date);

      let extraClass = '';
      if (selectionStart && !outOfRange && status === 'free') {
        if (isSameDay(date, selectionStart)) extraClass = ' avail-day-selected';
        else if (date > selectionStart) extraClass = ' avail-day-in-range-candidate';
      }

      const clickable = !outOfRange && status === 'free';

      cells += `
        <div class="avail-day avail-day-${status}${extraClass}"
             ${clickable ? `data-date="${iso}" data-clickable="1"` : ''}>
          <span>${d}</span>
        </div>`;
    }

    return `
      <div class="avail-month">
        <h4>${MONTHS_ES[month]} ${year}</h4>
        <div class="avail-grid avail-grid-header">
          ${WEEKDAYS_ES.map((w) => `<div class="avail-weekday">${w}</div>`).join('')}
        </div>
        <div class="avail-grid">${cells}</div>
      </div>
    `;
  },

  render() {
    const container = document.querySelector(this._state.containerSelector);
    if (!container) return;

    const today = dateOnly(new Date());
    const maxDate = new Date(today);
    maxDate.setMonth(maxDate.getMonth() + 1);

    const monthsHtml = [0, 1].map((offset) => {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      return this.renderMonth(d.getFullYear(), d.getMonth(), today, maxDate);
    }).join('');

    const manualBlocks = this._state.blockedDates;

    container.innerHTML = `
      <div class="availability-calendar">
        ${this._state.error ? `<p class="error-message">${this._state.error}</p>` : ''}
        <div id="avail-inline-error"></div>
        <div class="avail-legend">
          <span class="avail-legend-item"><i class="avail-swatch avail-swatch-free"></i> Libre</span>
          <span class="avail-legend-item"><i class="avail-swatch avail-swatch-blocked-host"></i> Bloqueado por ti</span>
          <span class="avail-legend-item"><i class="avail-swatch avail-swatch-blocked-admin"></i> Bloqueado por admin</span>
          <span class="avail-legend-item"><i class="avail-swatch avail-swatch-reserved"></i> Reservado</span>
        </div>
        <p class="avail-hint">${this._state.selectionStart ? 'Selecciona el día final del rango a bloquear.' : 'Selecciona el día de inicio del rango a bloquear.'}</p>
        <div class="avail-months">${monthsHtml}</div>

        <div class="avail-block-list">
          <h3>Fechas bloqueadas manualmente</h3>
          ${manualBlocks.length === 0 ? '<p class="no-results">No hay fechas bloqueadas.</p>' : manualBlocks.map((b) => `
            <div class="avail-block-item">
              <span>${new Date(b.start_date).toLocaleDateString()} — ${new Date(b.end_date).toLocaleDateString()}
                ${b.reason ? `<em>(${b.reason})</em>` : ''}
                <small>· bloqueado por ${b.blocked_by === 'admin' ? 'admin' : 'ti'}</small>
              </span>
              <button class="avail-block-remove" data-block-id="${b._id}" title="Eliminar bloqueo">×</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.attachEvents(container);
  },

  attachEvents(container) {
    container.querySelectorAll('[data-clickable="1"]').forEach((el) => {
      el.addEventListener('click', () => this.handleDayClick(el.dataset.date));
    });

    container.querySelectorAll('.avail-block-remove').forEach((btn) => {
      btn.addEventListener('click', () => this.handleUnblock(btn.dataset.blockId));
    });
  },

  handleDayClick(iso) {
    const clicked = dateOnly(iso);

    if (!this._state.selectionStart) {
      this._state.selectionStart = clicked;
      this.render();
      return;
    }

    if (isSameDay(clicked, this._state.selectionStart)) {
      this._state.selectionStart = null;
      this.render();
      return;
    }

    const start = clicked < this._state.selectionStart ? clicked : this._state.selectionStart;
    const end = clicked < this._state.selectionStart ? this._state.selectionStart : clicked;
    this._state.selectionStart = null;

    this.showConfirmModal(start, end);
  },

  showConfirmModal(start, end) {
    const existing = document.getElementById('avail-confirm-modal');
    if (existing) existing.remove();

    const endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const modal = document.createElement('div');
    modal.id = 'avail-confirm-modal';
    modal.className = 'avail-modal-overlay';
    modal.innerHTML = `
      <div class="avail-modal">
        <h3>Confirmar bloqueo</h3>
        <p>¿Confirmas bloquear del <strong>${start.toLocaleDateString()}</strong> al <strong>${end.toLocaleDateString()}</strong>?</p>
        <div class="form-group">
          <label>Motivo (opcional)</label>
          <select id="avail-block-reason">
            <option value="maintenance">Mantenimiento</option>
            <option value="personal">Uso personal</option>
            <option value="external_booking">Reserva fuera de la plataforma</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div class="avail-modal-actions">
          <button class="btn btn-outline" id="avail-modal-cancel">Cancelar</button>
          <button class="btn btn-primary" id="avail-modal-confirm">Confirmar bloqueo</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('avail-modal-cancel').addEventListener('click', () => {
      modal.remove();
      this.render();
    });

    document.getElementById('avail-modal-confirm').addEventListener('click', async () => {
      const reason = document.getElementById('avail-block-reason').value;
      modal.remove();
      await this.handleBlock(start, endExclusive, reason);
    });
  },

  async handleBlock(start, endExclusive, reason) {
    const { propertyId, mode } = this._state;
    const inlineError = document.getElementById('avail-inline-error');

    try {
      await api.post(`${this.basePath(mode, propertyId)}/availability/block`, {
        start_date: toISODate(start),
        end_date: toISODate(endExclusive),
        reason,
      });
      await this.loadAndRender();
    } catch (error) {
      const message = error.message === 'DATE_CONFLICT'
        ? 'No se puede bloquear: ese rango choca con una reserva activa de la plataforma.'
        : 'No se pudo bloquear el rango seleccionado.';
      if (inlineError) {
        inlineError.innerHTML = `<p class="error-message">${message}</p>`;
      }
      this.render();
    }
  },

  async handleUnblock(blockId) {
    const { propertyId, mode } = this._state;
    try {
      await api.delete(`${this.basePath(mode, propertyId)}/availability/block/${blockId}`);
      await this.loadAndRender();
    } catch (error) {
      const inlineError = document.getElementById('avail-inline-error');
      if (inlineError) {
        inlineError.innerHTML = '<p class="error-message">No se pudo eliminar el bloqueo.</p>';
      }
    }
  },
};

export default AvailabilityCalendar;
