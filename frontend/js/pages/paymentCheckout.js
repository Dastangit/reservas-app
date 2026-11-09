import api from '../api.js';
import i18n from '../i18n.js';
import { escapeHtml } from '../utils/escape.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { paymentSplitHtml } from '../utils/paymentSplit.js';

const PaymentCheckoutPage = {
  bookingId: null,

  async render() {
    const t = (key) => i18n.t(key);
    const params = new URLSearchParams(window.location.search);
    this.bookingId = params.get('booking_id');

    if (!this.bookingId) {
      return `<div class="container"><p class="error">${t('booking.checkoutNoBooking')}</p></div>`;
    }

    // Resumen de lo que se paga. Si no se puede cargar, el pago sigue
    // funcionando: solo falta el resumen.
    let booking = null;
    try {
      const response = await api.get(`/bookings/${encodeURIComponent(this.bookingId)}`);
      booking = response.data?.booking || null;
    } catch (error) {
      console.error('Error loading booking:', error);
    }
    const fee = formatCurrency(booking?.fee_amount ?? 7, booking?.fee_currency || 'USD');

    return `
      <div class="checkout-page">
        <div class="container">
          <div class="checkout-info">
            <h1>${t('booking.checkoutTitle')}</h1>

            ${booking ? `
            <div class="checkout-summary">
              <p class="checkout-summary-name">${escapeHtml(booking.property_id?.name || t('booking.propertyFallback'))}</p>
              <p class="checkout-summary-dates">${escapeHtml(formatDate(booking.check_in))} – ${escapeHtml(formatDate(booking.check_out))}</p>
              ${paymentSplitHtml({
                fee,
                stayAmount: formatCurrency(booking.total_amount),
                stayDetail: `${booking.num_nights} × ${formatCurrency(booking.property_id?.price_per_night ?? booking.total_amount / booking.num_nights)}`,
              })}
            </div>` : ''}

            <div id="checkout-choice">
              <fieldset class="checkout-methods">
                <legend>${t('booking.checkoutChoosePayment')}</legend>
                <label class="checkout-method">
                  <input type="radio" name="checkout-method" value="qvapay" checked>
                  <span><strong>${t('booking.checkoutQvapay')}</strong><small>${t('booking.checkoutQvapayHint')}</small></span>
                </label>
                <label class="checkout-method">
                  <input type="radio" name="checkout-method" value="paypal">
                  <span><strong>${t('booking.checkoutPaypal')}</strong><small>${t('booking.checkoutPaypalHint')}</small></span>
                </label>
              </fieldset>
              <button type="button" id="checkout-pay" class="btn btn-cta btn-block">${t('booking.checkoutPay')} ${escapeHtml(fee)}</button>
              <p class="fee-note">${t('booking.feeRefundNote')}</p>
            </div>

            <div id="checkout-loading" style="display:none;">
              <p>${t('booking.checkoutPreparing')}</p>
              <div class="loading-spinner"></div>
            </div>

            <div id="checkout-paypal-manual" style="display:none;">
              <p>${t('booking.checkoutPaypalInstructions')}</p>
              <a id="paypal-manual-link" href="#" target="_blank" class="btn btn-primary">${t('booking.checkoutPaypalGo')}</a>
              <p style="margin-top:1rem;">${t('booking.checkoutPaypalConfirmPrompt')}</p>
              <div class="form-group">
                <label for="paypal-reference">${t('booking.checkoutPaypalReference')}</label>
                <input type="text" id="paypal-reference" maxlength="200" autocomplete="off">
              </div>
              <div class="form-group">
                <label for="paypal-payer-email">${t('booking.checkoutPaypalPayerEmail')}</label>
                <input type="email" id="paypal-payer-email" maxlength="200">
              </div>
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

    document.getElementById('checkout-pay')?.addEventListener('click', () => {
      const method = document.querySelector('input[name="checkout-method"]:checked')?.value;
      if (method === 'paypal') this.payWithPaypalManual();
      else this.payWithQvaPay();
    });
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
      this.showError(error.code === 'qvapay_unavailable' ? i18n.t('booking.qvapayUnavailable') : error.message);
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
          // Sin ID de transaccion o email del pagador el admin no puede
          // identificar el deposito (todas las reservas pagan lo mismo).
          const reference = document.getElementById('paypal-reference')?.value.trim();
          const payerEmail = document.getElementById('paypal-payer-email')?.value.trim();
          if (!reference && !payerEmail) {
            alert(i18n.t('booking.checkoutPaypalReferenceRequired'));
            return;
          }
          e.target.disabled = true;
          try {
            await api.post('/payments/paypal-manual/notify-sent', {
              booking_id: this.bookingId,
              reference,
              payer_email: payerEmail,
            });
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
