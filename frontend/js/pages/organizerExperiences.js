import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const OrganizerExperiencesPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return `<div class="container"><p>${t('organizer.accessDenied')}</p></div>`;
    }

    return `
      <div class="manage-properties-page">
        <div class="container">
          <div class="page-header">
            <h1>${t('organizer.myExperiences')}</h1>
            <a href="/organizer/experiences/new" data-link class="btn btn-primary">+ ${t('organizer.newExperience')}</a>
          </div>
          <div id="experiences-list">
            <p class="loading">${t('common.loading')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    const list = document.getElementById('experiences-list');
    try {
      const response = await api.get('/organizer/experiences');
      const experiences = response.data?.experiences || [];

      if (experiences.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('organizer.noExperiencesYet')}</p>`;
        return;
      }

      list.innerHTML = experiences.map((exp) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${exp.title}${exp.recurrence_id ? ` <span class="audit-log-badge">${i18n.t('organizer.recurringBadge')}</span>` : ''}</h3>
            <p>${exp.location?.city || ''} · ${new Date(exp.date).toLocaleDateString(i18n.currentLang)}</p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">
              ${exp.current_participants}/${exp.max_participants} ${i18n.t('organizer.spotsLabel')} · ${i18n.t('booking.statusLabel')} ${exp.status}
            </p>
          </div>
          <div class="property-actions">
            <a href="/organizer/experiences/${exp._id}/edit" data-link class="btn btn-outline btn-sm">${i18n.t('common.edit')}</a>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('experience.errorLoadingList')}</p>`;
    }
  },
};

export default OrganizerExperiencesPage;
