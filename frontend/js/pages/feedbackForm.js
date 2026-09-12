import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const FeedbackFormPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('feedback.loginRequired')}</p></div>`;
    }

    return `
      <div class="feedback-form-page">
        <div class="container">
          <h1>${t('feedback.title')}</h1>
          <p>${t('feedback.subtitle')}</p>

          <form id="feedback-form">
            <div class="form-group">
              <label>${t('feedback.categoryLabel')}</label>
              <select id="category">
                <option value="other">${t('feedback.categoryOther')}</option>
                <option value="ux">${t('feedback.categoryUx')}</option>
                <option value="payment">${t('feedback.categoryPayment')}</option>
                <option value="communication">${t('feedback.categoryCommunication')}</option>
                <option value="features">${t('feedback.categoryFeatures')}</option>
              </select>
            </div>

            <div class="form-group">
              <label>${t('feedback.messageLabel')}</label>
              <textarea id="message" rows="5" required placeholder="${t('feedback.messagePlaceholder')}"></textarea>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>
            <div id="success-message" class="success-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary">${t('feedback.submitBtn')}</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('feedback-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  },

  async handleSubmit() {
    const category = document.getElementById('category')?.value;
    const message = document.getElementById('message')?.value;
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');

    try {
      const response = await api.post('/feedback', { category, message });

      if (response.success) {
        successEl.textContent = i18n.t('feedback.submitSuccess');
        successEl.style.display = 'block';
        errorEl.style.display = 'none';

        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('feedback.submitFailed');
      errorEl.style.display = 'block';
    }
  }
};

export default FeedbackFormPage;
