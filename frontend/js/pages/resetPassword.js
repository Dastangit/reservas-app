import api from '../api.js';
import i18n from '../i18n.js';
import { passwordToggleButton } from '../utils/passwordToggle.js';

const ResetPasswordPage = {
  token: null,

  render() {
    const t = (key) => i18n.t(key);
    const params = new URLSearchParams(window.location.search);
    this.token = params.get('token');

    if (!this.token) {
      return `
        <div class="auth-page">
          <div class="auth-container">
            <div class="auth-card">
              <h1>${t('auth.invalidLinkTitle')}</h1>
              <p class="auth-subtitle">${t('auth.invalidLinkSubtitle')}</p>
              <div class="auth-links">
                <p><a href="/forgot-password" data-link>${t('auth.requestNewLink')}</a></p>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="auth-page">
        <div class="auth-container">
          <div class="auth-card">
            <h1>${t('auth.newPasswordTitle')}</h1>
            <p class="auth-subtitle">${t('auth.newPasswordSubtitle')}</p>

            <form id="reset-form">
              <div class="form-group">
                <label for="new-password">${t('auth.newPassword')}</label>
                <div class="password-field-wrapper"><input type="password" id="new-password" required minlength="6" placeholder="Min 6 characters">
                  ${passwordToggleButton('new-password')}</div>
              </div>
              <div class="form-group">
                <label for="confirm-password">${t('auth.confirmPassword')}</label>
                <div class="password-field-wrapper"><input type="password" id="confirm-password" required minlength="6" placeholder="Repeat password">
                  ${passwordToggleButton('confirm-password')}</div>
              </div>

              <div id="error-message" class="error-message" style="display:none;"></div>

              <button type="submit" class="btn btn-primary btn-block" id="reset-submit">${t('auth.updatePassword')}</button>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('reset-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  },

  async handleSubmit() {
    const newPassword = document.getElementById('new-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const errorEl = document.getElementById('error-message');
    const submitBtn = document.getElementById('reset-submit');

    errorEl.style.display = 'none';

    if (newPassword !== confirmPassword) {
      errorEl.textContent = i18n.t('auth.passwordsDontMatch');
      errorEl.style.display = 'block';
      return;
    }

    try {
      submitBtn.disabled = true;
      const response = await api.post('/auth/reset-password', {
        token: this.token,
        new_password: newPassword,
      });

      if (response.success) {
        alert(i18n.t('auth.passwordUpdated'));
        window.location.href = '/login';
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('auth.resetLinkExpired');
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  }
};

export default ResetPasswordPage;
