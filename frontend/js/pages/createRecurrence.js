import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const CreateRecurrencePage = {
  images: [],

  async render() {
    const t = (key) => i18n.t(key);
    const days = t('createRecurrence.days');

    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return `<div class="container"><p>${t('organizer.accessDenied')}</p></div>`;
    }

    return `
      <div class="publish-property-page">
        <div class="container">
          <h1>${t('organizer.newRecurringExperience')}</h1>
          <p style="color:var(--text-light);">${t('createRecurrence.subtitle')}</p>

          <form id="recurrence-form">
            <div class="form-section">
              <h2>${t('propertyForm.basicInfo')}</h2>

              <div class="form-group">
                <label>${t('createExperience.titleLabel')}</label>
                <input type="text" id="rec-title" required>
              </div>

              <div class="form-group">
                <label>${t('createExperience.descriptionLabel')}</label>
                <textarea id="rec-description" rows="4" required></textarea>
              </div>

              <div class="form-group">
                <label>${t('createExperience.categoryLabel')}</label>
                <input type="text" id="rec-category" placeholder="${t('experience.categoryPlaceholder')}">
              </div>

              <div class="form-group">
                <label>${t('propertyForm.cityLabel')}</label>
                <input type="text" id="rec-city" required>
              </div>

              <div class="form-group">
                <label>${t('createExperience.durationLabel')}</label>
                <input type="number" id="rec-duration" min="0">
              </div>

              <div class="form-group">
                <label>${t('createRecurrence.maxSpotsPerOccurrenceLabel')}</label>
                <input type="number" id="rec-max-participants" min="1" required>
              </div>
            </div>

            <div class="form-section">
              <h2>${t('createRecurrence.frequencySection')}</h2>

              <div class="form-group">
                <label>${t('createRecurrence.daysOfWeekLabel')}</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  ${days.map((label, value) => `
                    <label style="display:flex;align-items:center;gap:4px;">
                      <input type="checkbox" class="rec-day" value="${value}"> ${label}
                    </label>
                  `).join('')}
                </div>
              </div>

              <div class="form-group">
                <label>${t('createRecurrence.timeLabel')}</label>
                <input type="time" id="rec-time" value="09:00" required>
              </div>

              <div class="form-group">
                <label>${t('createRecurrence.startDateLabel')}</label>
                <input type="date" id="rec-start-date" required>
              </div>

              <div class="form-group">
                <label>${t('createRecurrence.endDateLabel')}</label>
                <input type="date" id="rec-end-date">
              </div>
            </div>

            <div class="form-section">
              <h2>${t('createExperience.pricingSection')}</h2>
              <div id="pricing-rows">
                <div class="form-group pricing-row" style="display:flex;gap:10px;align-items:end;">
                  <div style="flex:1;">
                    <label>${t('createExperience.audienceLabel')}</label>
                    <select class="pricing-audience">
                      <option value="tourist">${t('experience.tourist')}</option>
                      <option value="local">${t('experience.local')}</option>
                    </select>
                  </div>
                  <div style="flex:1;">
                    <label>${t('createExperience.currencyLabel')}</label>
                    <select class="pricing-currency">
                      <option value="USD">USD</option>
                      <option value="USDT">USDT</option>
                      <option value="CUP">CUP</option>
                    </select>
                  </div>
                  <div style="flex:1;">
                    <label>${t('createExperience.pricePerSpotLabel')}</label>
                    <input type="number" class="pricing-amount" min="0" step="0.01" required>
                  </div>
                  <button type="button" class="btn btn-danger btn-sm remove-pricing-row" style="display:none;">X</button>
                </div>
              </div>
              <button type="button" id="add-pricing-btn" class="btn btn-outline btn-sm">${t('createExperience.addPriceBtn')}</button>
            </div>

            <div class="form-section">
              <h2>${t('createExperience.mixedAudienceSection')}</h2>
              <label style="display:flex;align-items:flex-start;gap:8px;">
                <input type="checkbox" id="rec-mixed-audience" style="margin-top:4px;">
                <span>
                  ${t('createRecurrence.mixedAudienceSeriesLabel')}
                  <br><strong style="color:var(--danger, #c0392b);">${t('createExperience.mixedAudienceWarning')}</strong>
                  ${t('createRecurrence.mixedAudienceSeriesNote')}
                </span>
              </label>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary btn-block">${t('createRecurrence.createSeriesBtn')}</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    const t = (key) => i18n.t(key);

    document.getElementById('add-pricing-btn')?.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'form-group pricing-row';
      row.style.cssText = 'display:flex;gap:10px;align-items:end;';
      row.innerHTML = `
        <div style="flex:1;"><label>${t('createExperience.audienceLabel')}</label>
          <select class="pricing-audience"><option value="tourist">${t('experience.tourist')}</option><option value="local">${t('experience.local')}</option></select>
        </div>
        <div style="flex:1;"><label>${t('createExperience.currencyLabel')}</label>
          <select class="pricing-currency"><option value="USD">USD</option><option value="USDT">USDT</option><option value="CUP">CUP</option></select>
        </div>
        <div style="flex:1;"><label>${t('createExperience.pricePerSpotLabel')}</label><input type="number" class="pricing-amount" min="0" step="0.01" required></div>
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
      errorEl.textContent = i18n.t('createRecurrence.selectDayError');
      errorEl.style.display = 'block';
      return;
    }

    const pricing = Array.from(document.querySelectorAll('.pricing-row')).map((row) => ({
      audience: row.querySelector('.pricing-audience').value,
      currency: row.querySelector('.pricing-currency').value,
      amount: parseFloat(row.querySelector('.pricing-amount').value),
    }));

    if (pricing.some((p) => Number.isNaN(p.amount))) {
      errorEl.textContent = i18n.t('createExperience.pricingValidationError');
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
      alert(`${i18n.t('createRecurrence.seriesCreatedPrefix')}${response.data.occurrences_generated}${i18n.t('createRecurrence.seriesCreatedMiddle')}`);
      window.location.href = '/organizer/recurrences';
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('createRecurrence.createSeriesFailed');
      errorEl.style.display = 'block';
    }
  },
};

export default CreateRecurrencePage;
