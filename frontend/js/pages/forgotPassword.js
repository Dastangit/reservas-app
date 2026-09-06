import api from '../api.js';
import i18n from '../i18n.js';

const ForgotPasswordPage = {
  render() {
    const t = (key) => i18n.t(key);
    return `
      <div class="auth-page">
        <div class="auth-container">
          <div class="auth-card">
            <h1>${t('auth.forgotPasswordTitle')}</h1>
            <p class="auth-subtitle">${t('auth.forgotPasswordSubtitle')}</p>

            <form id="forgot-form">
              <div class="form-group">
                <label for="email">${t('auth.email')}</label>
                <input type="email" id="email" required placeholder="your@email.com">
              </div>

              <div id="error-message" class="error-message" style="display:none;"></div>
              <div id="success-message" class="success-message" style="display:none;"></div>

              <button type="submit" class="btn btn-primary btn-block" id="forgot-submit">${t('auth.sendRequest')}</button>
            </form>

            <div class="auth-links">
              <p><a href="/login" data-link>${t('auth.backToLogin')}</a></p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('forgot-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  },

  async handleSubmit() {
    const email = document.getElementById('email')?.value;
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');
    const submitBtn = document.getElementById('forgot-submit');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    try {
      submitBtn.disabled = true;
      const response = await api.post('/auth/forgot-password', { email });
      if (response.success) {
        successEl.textContent = i18n.t('auth.forgotPasswordSuccess');
        successEl.style.display = 'block';
        document.getElementById('forgot-form').reset();
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('auth.forgotPasswordError');
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  }
};

export default ForgotPasswordPage;
