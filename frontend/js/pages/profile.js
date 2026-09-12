import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const ProfilePage = {
  async render() {
    const t = (key) => i18n.t(key);
    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('profile.loginPromptBefore')} <a href="/login" data-link>${t('common.login')}</a> ${t('profile.loginPromptAfter')}</p></div>`;
    }

    const user = auth.getUser();

    return `
      <div class="profile-page">
        <div class="container">
          <h1>${t('profile.title')}</h1>
          
          <div class="profile-card">
            <form id="profile-form">
              <div class="form-group">
                <label>${t('profile.name')}</label>
                <input type="text" id="name" value="${user?.name || ''}" required>
              </div>
              
              <div class="form-group">
                <label>${t('profile.email')}</label>
                <input type="email" id="email" value="${user?.email || ''}" disabled>
              </div>
              
              <div class="form-group">
                <label>${t('profile.phone')}</label>
                <input type="tel" id="phone" value="${user?.phone || ''}">
              </div>
              
              <div class="form-group">
                <label>${t('profile.role')}</label>
                <input type="text" value="${user?.role || ''}" disabled>
              </div>
              
              <div id="error-message" class="error-message" style="display:none;"></div>
              <div id="success-message" class="success-message" style="display:none;"></div>
              
              <button type="submit" class="btn btn-primary">${t('profile.saveChanges')}</button>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('profile-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSave();
      });
    }
  },

  async handleSave() {
    const name = document.getElementById('name')?.value;
    const phone = document.getElementById('phone')?.value;
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');

    try {
      const response = await api.put('/users/profile', { name, phone });

      if (response.success) {
        successEl.textContent = i18n.t('profile.updateSuccess');
        successEl.style.display = 'block';
        errorEl.style.display = 'none';

        const user = auth.getUser();
        auth.setAuth(auth.getToken(), auth.getRefreshToken(), { ...user, name, phone });
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('profile.updateFailed');
      errorEl.style.display = 'block';
    }
  }
};

export default ProfilePage;
