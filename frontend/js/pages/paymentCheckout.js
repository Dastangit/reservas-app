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
          <h1>Pago del fee de reserva</h1>
          <p>Te vamos a redirigir para completar el pago con tarjeta.</p>
          
          <div class="checkout-info">
            <p>Please wait while we prepare your payment...</p>
            <div class="loading-spinner"></div>
            <div id="checkout-error" class="error-message" style="display:none; margin-top: 1rem;"></div>
            <a id="checkout-retry" href="#" style="display:none; margin-top: 1rem;" class="btn btn-primary">Retry</a>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    if (!this.bookingId) return;

    this.createInvoice();
  },

  async createInvoice() {
    const errorEl = document.getElementById('checkout-error');
    const retryEl = document.getElementById('checkout-retry');

    try {
      const response = await api.post('/payments/create-invoice', { booking_id: this.bookingId });
      if (response.success && response.data.invoice_url) {
        window.location.href = response.data.invoice_url;
      } else {
        throw new Error('No invoice URL returned');
      }
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || 'Failed to create payment';
        errorEl.style.display = 'block';
      }
      if (retryEl) {
        retryEl.style.display = 'inline-block';
        retryEl.addEventListener('click', (e) => {
          e.preventDefault();
          errorEl.style.display = 'none';
          retryEl.style.display = 'none';
          this.createInvoice();
        });
      }
    }
  }
};

export default PaymentCheckoutPage;
