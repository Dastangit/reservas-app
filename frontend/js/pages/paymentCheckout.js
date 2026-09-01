import api from '../api.js';

const PaymentCheckoutPage = {
  bookingId: null,

  async render() {
    const params = new URLSearchParams(window.location.search);
    this.bookingId = params.get('booking_id');

    if (!this.bookingId) {
      return '<div class="container"><p class="error">No booking specified.</p></div>';
    }

    return `
      <div class="checkout-page">
        <div class="container">
          <div class="checkout-info">
            <h1>Pago del fee de reserva</h1>

            <div id="checkout-choice">
              <p>Elige cómo prefieres pagar el fee de reserva:</p>
              <div class="checkout-methods">
                <button id="method-qvapay" class="btn btn-primary">Pagar con QvaPay (tarjeta / saldo)</button>
                <button id="method-paypal" class="btn btn-outline">Pagar con PayPal (transferencia manual)</button>
              </div>
            </div>

            <div id="checkout-loading" style="display:none;">
              <p>Preparando tu pago...</p>
              <div class="loading-spinner"></div>
            </div>

            <div id="checkout-paypal-manual" style="display:none;">
              <p>Usa este link para pagar el fee por PayPal. Puedes pagar con tarjeta sin necesidad de cuenta de PayPal.</p>
              <a id="paypal-manual-link" href="#" target="_blank" class="btn btn-primary">Ir a pagar por PayPal</a>
              <p style="margin-top:1rem;">Cuando termines el pago, presiona el siguiente botón para avisarnos:</p>
              <button id="paypal-manual-confirm" class="btn btn-success">Ya pagué</button>
              <p id="paypal-manual-thanks" style="display:none; margin-top:1rem;">
                ¡Gracias! Le avisamos al equipo, revisarán tu pago y confirmaremos tu reserva pronto.
              </p>
            </div>

            <div id="checkout-error" class="error-message" style="display:none; margin-top: 1rem;"></div>
            <a id="checkout-retry" href="#" style="display:none; margin-top: 1rem;" class="btn btn-primary">Retry</a>
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
    errorEl.textContent = message || 'Failed to create payment';
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
            alert('No se pudo avisar al equipo, intenta de nuevo: ' + error.message);
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
