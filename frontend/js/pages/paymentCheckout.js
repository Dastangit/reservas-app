import api from '../api.js';
import i18n from '../i18n.js';

const PaymentCheckoutPage = {
  bookingId: null,

  async render() {
    const t = (key) => i18n.t(key);
    const params = new URLSearchParams(window.location.search);
    this.bookingId = params.get('booking_id');

    if (!this.bookingId) {
      return `<div class="container"><p class="error">${t('booking.checkoutNoBooking')}</p></div>`;
    }

    return `
      <div class="checkout-page">
        <div class="container">
          <div class="checkout-info">
            <h1>${t('booking.checkoutTitle')}</h1>

            <div id="checkout-choice">
              <p>${t('booking.checkoutChoosePayment')}</p>
              <div class="checkout-methods">
                <button id="method-qvapay" class="btn btn-primary">${t('booking.checkoutQvapay')}</button>
                <button id="method-paypal" class="btn btn-outline">${t('booking.checkoutPaypal')}</button>
              </div>
            </div>

            <div id="checkout-loading" style="display:none;">
              <p>${t('booking.checkoutPreparing')}</p>
              <div class="loading-spinner"></div>
            </div>

            <div id="checkout-paypal-manual" style="display:none;">
              <p>${t('booking.checkoutPaypalInstructions')}</p>
              <a id="paypal-manual-link" href="#" target="_blank" class="btn btn-primary">${t('booking.checkoutPaypalGo')}</a>
              <p style="margin-top:1rem;">${t('booking.checkoutPaypalConfirmPrompt')}</p>
              <button id="paypal-manual-confirm" class="btn btn-success">${t('booking.checkoutPaypalPaid')}</button>
              <p id="paypal-manual-thanks" style="display:none; margin-top:1rem;">
                ${t('booking.checkoutPaypalThanks')}
              </p>
            </div>

            <div id="checkout-error" class="error-message" style="display:none; margin-top: 1rem;"></div>
            <a id="checkout-retry" href="#" style="display:none; margin-top: 1rem;" class="btn btn-primary">${t('booking.checkoutRetry')}</a>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    if (!this.bookingId) return;

    document.getElementById('method-qvapay')?.addEventListener('click', () => this.payWithQvaPay());
    document.getElementById('method-paypal')?.addEventListener('click', () => this.payWithPaypalManual());
  },

  showLoading() {
    document.getElementById('checkout-choice').style.display = 'none';
    document.getElementById('checkout-loading').style.display = 'block';
  },

  showError(message) {
    document.getElementById('checkout-loading').style.display = 'none';
    const errorEl = document.getElementById('checkout-error');
    const retryEl = document.getElementById('checkout-retry');
    errorEl.textContent = message || i18n.t('booking.checkoutFailed');
    errorEl.style.display = 'block';
    retryEl.style.display = 'inline-block';
    retryEl.onclick = (e) => {
      e.preventDefault();
      errorEl.style.display = 'none';
      retryEl.style.display = 'none';
      document.getElementById('checkout-choice').style.display = 'block';
    };
  },

  async payWithQvaPay() {
    this.showLoading();
    try {
      const response = await api.post('/payments/create-invoice', { booking_id: this.bookingId });
      if (response.success && response.data.invoice_url) {
        window.location.href = response.data.invoice_url;
      } else {
        throw new Error('No invoice URL returned');
      }
    } catch (error) {
      this.showError(error.message);
    }
  },

  async payWithPaypalManual() {
    this.showLoading();
    try {
      const response = await api.post('/payments/paypal-manual', { booking_id: this.bookingId });
      if (response.success && response.data.paypal_url) {
        document.getElementById('checkout-loading').style.display = 'none';
        const section = document.getElementById('checkout-paypal-manual');
        section.style.display = 'block';

        const link = document.getElementById('paypal-manual-link');
        link.href = response.data.paypal_url;

        document.getElementById('paypal-manual-confirm').addEventListener('click', async (e) => {
          e.target.disabled = true;
          try {
            await api.post('/payments/paypal-manual/notify-sent', { booking_id: this.bookingId });
            document.getElementById('paypal-manual-thanks').style.display = 'block';
          } catch (error) {
            e.target.disabled = false;
            alert(i18n.t('booking.checkoutNotifyFailed') + error.message);
          }
        });
      } else {
        throw new Error('No PayPal link returned');
      }
    } catch (error) {
      this.showError(error.message);
    }
  }
};

export default PaymentCheckoutPage;
