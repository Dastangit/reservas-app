import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const OrganizerRecurrencesPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return `<div class="container"><p>${t('organizer.accessDenied')}</p></div>`;
    }

    return `
      <div class="manage-properties-page">
        <div class="container">
          <div class="page-header">
            <h1>${t('organizer.myRecurringExperiences')}</h1>
            <a href="/organizer/recurrences/new" data-link class="btn btn-primary">+ ${t('organizer.newSeries')}</a>
          </div>
          <div id="recurrences-list">
            <p class="loading">${t('common.loading')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    window.pauseRecurrence = async (id) => {
      try {
        await api.post(`/organizer/recurrences/${id}/pause`);
        await this.load();
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.endRecurrence = async (id) => {
      if (!confirm(i18n.t('organizer.endSeriesConfirm'))) return;
      try {
        await api.post(`/organizer/recurrences/${id}/end`);
        await this.load();
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    await this.load();
  },

  async load() {
    const list = document.getElementById('recurrences-list');
    try {
      const response = await api.get('/organizer/recurrences');
      const recurrences = response.data?.recurrences || [];

      if (recurrences.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('organizer.noRecurringExperiencesYet')}</p>`;
        return;
      }

      list.innerHTML = recurrences.map((r) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${r.title}</h3>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">
              ${r.occurrences_generated || 0} ${i18n.t('organizer.occurrencesGeneratedSuffix')} · ${i18n.t('booking.statusLabel')} ${r.status}
            </p>
          </div>
          <div class="property-actions">
            <a href="/organizer/recurrences/${r._id}/occurrences" data-link class="btn btn-outline btn-sm">${i18n.t('organizer.viewOccurrencesBtn')}</a>
            ${r.status === 'active' ? `<button class="btn btn-outline btn-sm" onclick="pauseRecurrence('${r._id}')">${i18n.t('organizer.pauseBtn')}</button>` : ''}
            ${r.status !== 'ended' ? `<button class="btn btn-danger btn-sm" onclick="endRecurrence('${r._id}')">${i18n.t('organizer.endBtn')}</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('organizer.errorLoadingRecurrences')}</p>`;
    }
  },
};

export default OrganizerRecurrencesPage;
