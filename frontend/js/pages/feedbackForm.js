import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const FeedbackFormPage = {
  // Reclamo sobre una reserva: /feedback?category=complaint&booking_id=...
  complaintBookingId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('category') === 'complaint' ? params.get('booking_id') : null;
  },

  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('feedback.loginRequired')}</p></div>`;
    }

    const complaint = Boolean(this.complaintBookingId());

    return `
      <div class="feedback-form-page">
        <div class="container">
          <h1>${complaint ? t('feedback.complaintTitle') : t('feedback.title')}</h1>
          <p>${complaint ? t('feedback.complaintSubtitle') : t('feedback.subtitle')}</p>
          ${complaint ? `<p class="field-hint">${t('services.refundRule')}</p>` : ''}

          <form id="feedback-form">
            ${complaint ? '' : `
            <div class="form-group">
              <label>${t('feedback.categoryLabel')}</label>
              <select id="category">
                <option value="other">${t('feedback.categoryOther')}</option>
                <option value="ux">${t('feedback.categoryUx')}</option>
                <option value="payment">${t('feedback.categoryPayment')}</option>
                <option value="communication">${t('feedback.categoryCommunication')}</option>
                <option value="features">${t('feedback.categoryFeatures')}</option>
              </select>
            </div>`}

            <div class="form-group">
              <label>${t('feedback.messageLabel')}</label>
              <textarea id="message" rows="5" required placeholder="${complaint ? t('feedback.complaintPlaceholder') : t('feedback.messagePlaceholder')}"></textarea>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>
            <div id="success-message" class="success-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary">${complaint ? t('feedback.complaintSubmit') : t('feedback.submitBtn')}</button>
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
    const bookingId = this.complaintBookingId();
    const category = bookingId ? 'complaint' : document.getElementById('category')?.value;
    const message = document.getElementById('message')?.value;
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');

    try {
      const response = await api.post('/feedback', {
        category,
        message,
        ...(bookingId ? { booking_id: bookingId } : {}),
      });

      if (response.success) {
        successEl.textContent = bookingId ? i18n.t('feedback.complaintSuccess') : i18n.t('feedback.submitSuccess');
        successEl.style.display = 'block';
        errorEl.style.display = 'none';

        setTimeout(() => {
          window.location.href = bookingId ? `/booking/summary/${encodeURIComponent(bookingId)}` : '/';
        }, 2000);
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('feedback.submitFailed');
      errorEl.style.display = 'block';
    }
  }
};

export default FeedbackFormPage;
