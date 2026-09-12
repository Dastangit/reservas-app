import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const AdminFeedbackPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-feedback-page">
        <div class="container">
          <h1>${t('admin.feedbackManagementTitle')}</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="">${t('dashboard.all')}</button>
            <button class="tab-btn" data-tab="new">${t('property.new')}</button>
            <button class="tab-btn" data-tab="responded">${t('admin.respondedTab')}</button>
          </div>
          
          <div id="feedback-list">
            <p class="loading">${t('admin.loadingFeedback')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.loadFeedback(e.target.dataset.tab);
      });
    });

    await this.loadFeedback('');

    window.respondFeedback = async (id) => {
      const response = prompt(i18n.t('admin.enterYourResponse'));
      if (response) {
        try {
          await api.post(`/admin/feedback/${id}/respond`, { response });
          alert(i18n.t('admin.responseSent'));
          this.loadFeedback(document.querySelector('.tab-btn.active')?.dataset.tab || '');
        } catch (error) {
          alert(i18n.t('common.errorPrefix') + error.message);
        }
      }
    };
  },

  async loadFeedback(status) {
    const list = document.getElementById('feedback-list');
    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const url = status ? `/admin/feedback?status=${status}` : '/admin/feedback';
      const response = await api.get(url);
      const feedback = response.data?.feedback || [];

      if (feedback.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('admin.noFeedbackFound')}</p>`;
        return;
      }

      list.innerHTML = feedback.map(f => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${f.category}</h3>
            <p>${f.message}</p>
            <p style="font-size:0.85rem;color:var(--text-light);">${i18n.t('admin.fromLabel')} ${f.user_id?.name || i18n.t('admin.unknownFallback')} - ${new Date(f.created_at).toLocaleDateString(i18n.currentLang)}</p>
            ${f.admin_response ? `<p><strong>${i18n.t('admin.adminResponseLabel')}</strong> ${f.admin_response}</p>` : ''}
          </div>
          <div class="property-actions">
            ${!f.admin_response ? `<button onclick="respondFeedback('${f._id}')" class="btn btn-primary btn-sm">${i18n.t('admin.respondBtn')}</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('admin.errorLoadingFeedback')}</p>`;
    }
  }
};

export default AdminFeedbackPage;
