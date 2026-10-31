import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { escapeHtml } from '../utils/escape.js';

const t = (key) => i18n.t(key);

const AdminPasswordResetsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-password-resets-page">
        <div class="container">
          <h1>${t('passwordResets.title')}</h1>
          <p class="page-subtitle">${t('passwordResets.subtitle')}</p>

          <div id="password-resets-list">
            <p class="loading">${t('common.loading')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    await this.loadRequests();

    window.deliverPasswordReset = async (userId, method) => {
      try {
        const response = await api.get(`/admin/password-resets/${userId}/delivery-links`);
        const url = method === 'whatsapp' ? response.data?.whatsapp_url : response.data?.mailto_url;
        if (url) {
          if (method === 'whatsapp') window.open(url, '_blank', 'noopener');
          else window.location.href = url;
        } else {
          alert(method === 'whatsapp' ? t('passwordResets.noPhone') : t('passwordResets.noEmail'));
        }
      } catch (error) {
        alert(t('common.errorPrefix') + error.message);
      }
    };
  },

  async loadRequests() {
    const list = document.getElementById('password-resets-list');
    if (!list) return;

    try {
      const response = await api.get('/admin/password-resets');
      const requests = response.data?.requests || [];

      if (requests.length === 0) {
        list.innerHTML = `<p class="no-results">${t('passwordResets.empty')}</p>`;
        return;
      }

      list.innerHTML = requests.map((r) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${escapeHtml(r.name)} <span class="status-badge pending">${escapeHtml(r.role)}</span></h3>
            <p>${escapeHtml(r.email)} ${escapeHtml(r.phone ? '· ' + r.phone : '')}</p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">${t('passwordResets.expires')} ${new Date(r.expires_at).toLocaleString(i18n.currentLang)}</p>
          </div>
          <div class="property-actions">
            <button data-action="deliverPasswordReset" data-arg="${escapeHtml(r.user_id)}" data-arg2="whatsapp" class="btn btn-outline btn-sm">WhatsApp</button>
            <button data-action="deliverPasswordReset" data-arg="${escapeHtml(r.user_id)}" data-arg2="mailto" class="btn btn-outline btn-sm">${t('passwordResets.email')}</button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${t('passwordResets.loadError')}</p>`;
    }
  }
};

export default AdminPasswordResetsPage;
