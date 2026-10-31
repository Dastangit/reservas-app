import api from '../api.js';
import { escapeHtml } from '../utils/escape.js';
import i18n from '../i18n.js';

// Componente de calendario de disponibilidad reutilizable.
// Uso: AvailabilityCalendar.mount('#calendar-root', { propertyId, mode: 'host' | 'admin' })
//
// mode 'host'   -> usa /properties/:id/availability/...
// mode 'admin'  -> usa /admin/properties/:id/availability/...

const t = (key) => i18n.t(key);

// Nombres de mes y dia en el idioma activo (Intl), en vez de listas fijas en espanol.
const monthName = (year, month) => {
  const name = new Date(year, month, 1).toLocaleDateString(i18n.currentLang, { month: 'long' });
  return name.charAt(0).toUpperCase() + name.slice(1);
};
const weekdayNames = () => [0, 1, 2, 3, 4, 5, 6].map((i) => (
  // 2023-01-01 fue domingo
  new Date(2023, 0, 1 + i).toLocaleDateString(i18n.currentLang, { weekday: 'short' }).slice(0, 2)
));
const REASONS = ['maintenance', 'personal', 'external_booking', 'other'];
const reasonLabel = (reason) => (REASONS.includes(reason) ? t(`calendar.reason.${reason}`) : reason);
const formatDay = (date) => date.toLocaleDateString(i18n.currentLang);

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateOnly(d) {
  // OJO: si 'd' es un string tipo "2026-07-25" (solo fecha, sin hora),
  // new Date(d) lo interpreta como medianoche UTC, no medianoche local --
  // en husos horarios detrás de UTC (como Cuba) eso desplaza la fecha un
  // día hacia atrás. Por eso parseamos el string manualmente como fecha
  // local cuando viene en ese formato.
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, day);
  }
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
      actionError: null,
    };

    container.innerHTML = `<p class="loading">${t('calendar.loading')}</p>`;
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
      this._state.error = t('calendar.loadError');
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

      // No tiene sentido mostrar días ya pasados como si fueran una celda
      // más del calendario -- se dejan en blanco, igual que el relleno de
      // inicio de semana.
      if (date < today) {
        cells += '<div class="avail-day avail-day-empty"></div>';
        continue;
      }

      const iso = toISODate(date);
      const outOfRange = date > maxDate;
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
        <h4>${escapeHtml(monthName(year, month))} ${year}</h4>
        <div class="avail-grid avail-grid-header">
          ${weekdayNames().map((w) => `<div class="avail-weekday">${escapeHtml(w)}</div>`).join('')}
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
        ${this._state.error ? `<p class="error-message">${escapeHtml(this._state.error)}</p>` : ''}
        <div id="avail-inline-error">${this._state.actionError ? `<p class="error-message">${escapeHtml(this._state.actionError)}</p>` : ''}</div>
        <div class="avail-legend">
          <span class="avail-legend-item"><i class="avail-swatch avail-swatch-free"></i> ${t('calendar.free')}</span>
          <span class="avail-legend-item"><i class="avail-swatch avail-swatch-blocked-host"></i> ${t('calendar.blockedByHost')}</span>
          <span class="avail-legend-item"><i class="avail-swatch avail-swatch-blocked-admin"></i> ${t('calendar.blockedByAdmin')}</span>
          <span class="avail-legend-item"><i class="avail-swatch avail-swatch-reserved"></i> ${t('calendar.reserved')}</span>
        </div>
        <p class="avail-hint">${this._state.selectionStart ? t('calendar.pickEnd') : t('calendar.pickStart')}</p>
        <div class="avail-months">${monthsHtml}</div>

        <div class="avail-block-list">
          <h3>${t('calendar.manualBlocks')}</h3>
          ${manualBlocks.length === 0 ? `<p class="no-results">${t('calendar.noBlocks')}</p>` : manualBlocks.map((b) => `
            <div class="avail-block-item">
              <span>${formatDay(dateOnly(b.start_date))} — ${formatDay(new Date(dateOnly(b.end_date).getTime() - 86400000))}
                ${b.reason ? `<em>(${escapeHtml(reasonLabel(b.reason))})</em>` : ''}
                <small>· ${b.blocked_by === 'admin' ? t('calendar.blockedByAdmin') : t('calendar.blockedByHost')}</small>
              </span>
              <button class="avail-block-remove" data-block-id="${b._id}" title="${t('calendar.removeBlock')}" aria-label="${t('calendar.removeBlock')}">×</button>
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
        <h3>${t('calendar.confirmTitle')}</h3>
        <p>${t('calendar.confirmText').replace('{start}', `<strong>${formatDay(start)}</strong>`).replace('{end}', `<strong>${formatDay(end)}</strong>`)}</p>
        <div class="form-group">
          <label for="avail-block-reason">${t('calendar.reasonLabel')}</label>
          <select id="avail-block-reason">
            ${REASONS.map((r) => `<option value="${r}">${t(`calendar.reason.${r}`)}</option>`).join('')}
          </select>
        </div>
        <div class="avail-modal-actions">
          <button class="btn btn-outline" id="avail-modal-cancel">${t('calendar.cancel')}</button>
          <button class="btn btn-primary" id="avail-modal-confirm">${t('calendar.confirmTitle')}</button>
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

    try {
      await api.post(`${this.basePath(mode, propertyId)}/availability/block`, {
        start_date: toISODate(start),
        end_date: toISODate(endExclusive),
        reason,
      });
      this._state.actionError = null;
      await this.loadAndRender();
    } catch (error) {
      // Se guarda en el estado: antes se escribia en el DOM y el render()
      // siguiente lo borraba, asi que el host nunca veia el error.
      this._state.actionError = error.message === 'DATE_CONFLICT' ? t('calendar.conflictError') : t('calendar.blockError');
      this.render();
    }
  },

  async handleUnblock(blockId) {
    const { propertyId, mode } = this._state;
    try {
      await api.delete(`${this.basePath(mode, propertyId)}/availability/block/${blockId}`);
      this._state.actionError = null;
      await this.loadAndRender();
    } catch (error) {
      this._state.actionError = t('calendar.unblockError');
      this.render();
    }
  },
};

export default AvailabilityCalendar;
