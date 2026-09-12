import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { formatExperiencePrice } from '../utils/formatters.js';

const AdminExperiencesPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-properties-page">
        <div class="container">
          <h1>${t('admin.pendingExperiencesTitle')}</h1>
          <p style="color:var(--text-light);">${t('admin.pendingExperiencesSubtitle')}</p>
          <div id="experiences-list">
            <p class="loading">${t('common.loading')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    window.approveExperienceAdmin = async (id) => {
      try {
        await api.post(`/admin/experiences/${id}/approve`);
        await this.load();
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.rejectExperienceAdmin = async (id) => {
      const reason = prompt(i18n.t('admin.enterRejectionReason'));
      if (reason === null) return;
      try {
        await api.post(`/admin/experiences/${id}/reject`, { reason });
        await this.load();
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    await this.load();
  },

  async load() {
    const list = document.getElementById('experiences-list');
    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const response = await api.get('/admin/experiences/pending');
      const experiences = response.data?.experiences || [];

      if (experiences.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('admin.noPendingExperiences')}</p>`;
        return;
      }

      list.innerHTML = experiences.map((exp) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>
              ${exp.title}${exp.recurrence_id ? ` <span class="audit-log-badge">${i18n.t('admin.recurringOccurrenceBadge')}</span>` : ''}
              ${exp.allows_mixed_audience ? ` <span class="audit-log-badge" style="border-color:#c0392b;color:#c0392b;">${i18n.t('admin.mixedAudienceWarningBadge')}</span>` : ''}
            </h3>
            <p>${exp.location?.city || ''} · ${new Date(exp.date).toLocaleString(i18n.currentLang)}</p>
            <p>${i18n.t('admin.organizerLabel')} ${exp.organizer_id?.name || i18n.t('admin.unknownFallback')} (${exp.organizer_id?.email || i18n.t('admin.noEmail')})</p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">
              ${(exp.pricing || []).map((p) => `${p.audience === 'local' ? i18n.t('organizer.audienceLocal') : i18n.t('organizer.audienceTourist')}: ${formatExperiencePrice(p.amount, p.currency)}`).join(' · ')}
            </p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">${i18n.t('admin.maxSpotsShort')} ${exp.max_participants}</p>
          </div>
          <div class="property-actions">
            <button onclick="approveExperienceAdmin('${exp._id}')" class="btn btn-success btn-sm">${i18n.t('admin.approveBtn')}</button>
            <button onclick="rejectExperienceAdmin('${exp._id}')" class="btn btn-danger btn-sm">${i18n.t('admin.rejectBtn')}</button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('admin.errorLoadingExperiencesAdmin')}</p>`;
    }
  },
};

export default AdminExperiencesPage;
