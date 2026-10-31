import api from '../api.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import i18n from '../i18n.js';
import { escapeHtml } from '../utils/escape.js';

// Icono y textos segun el estado real de la reserva: la pagina se puede abrir
// en cualquier momento (enlace, vuelta de QvaPay), no solo tras pagar.
// tone = clase de .status-badge (styles.css), que tambien colorea el icono.
const STATUS_VIEW = {
  pending_payment: { icon: '&#9203;', tone: 'pending' },
  pending_approval: { icon: '&#10003;', tone: 'pending' },
  approved: { icon: '&#10003;', tone: 'approved' },
  completed: { icon: '&#10003;', tone: 'completed' },
  rejected: { icon: '&#10007;', tone: 'cancelled' },
  cancelled: { icon: '&#10007;', tone: 'cancelled' },
};

// El turista ya reporto el pago (PayPal) o QvaPay lo tiene en curso.
const isVerifyingPayment = (booking) => booking.status === 'pending_payment'
  && (booking.payment_stage === 'pending' || Boolean(booking.payment_reported_at));

const BookingConfirmationPage = {
  async render() {
    const t = (key) => i18n.t(key);
    const bookingId = this._params?.bookingId;

    try {
      const response = await api.get(`/bookings/${bookingId}`);
      const booking = response.data?.booking;

      if (!booking) {
        return `<div class="container"><p class="error">${t('booking.bookingNotFound')}</p></div>`;
      }

      const textKey = isVerifyingPayment(booking) ? 'verifying' : booking.status;
      const text = (field) => t(`confirmation.status.${textKey}.${field}`);
      const statusKey = `bookingCard.status.${booking.status}`;
      const statusLabel = t(statusKey) === statusKey ? booking.status.replace(/_/g, ' ') : t(statusKey);
      const view = STATUS_VIEW[booking.status] || { icon: '&#8505;', tone: 'pending' };

      return `
        <div class="confirmation-page">
          <div class="container">
            <div class="confirmation-card">
              <div class="confirmation-icon ${view.tone}">${view.icon}</div>
              <h1>${text('title')}</h1>
              <p class="confirmation-subtitle">${text('subtitle')}</p>
              
              <div class="confirmation-details">
                <div class="detail-row">
                  <span>${t('booking.bookingId')}</span>
                  <span>${booking._id}</span>
                </div>
                <div class="detail-row">
                  <span>${t('booking.propertyLabel')}</span>
                  <span>${escapeHtml(booking.property_id?.name || 'N/A')}</span>
                </div>
                <div class="detail-row">
                  <span>${t('booking.checkIn')}:</span>
                  <span>${formatDate(booking.check_in)}</span>
                </div>
                <div class="detail-row">
                  <span>${t('booking.checkOut')}:</span>
                  <span>${formatDate(booking.check_out)}</span>
                </div>
                <div class="detail-row">
                  <span>${t('booking.statusLabel')}</span>
                  <span class="status-badge ${view.tone}">${escapeHtml(statusLabel)}</span>
                </div>
              </div>
              
              <div class="confirmation-message">
                <p><strong>${t('confirmation.whatNext')}</strong></p>
                <p>${text('message')}</p>
                ${booking.status === 'rejected' && booking.rejection_reason ? `<p><strong>${t('confirmation.reason')}</strong> ${escapeHtml(booking.rejection_reason)}</p>` : ''}
              </div>
              
              <div class="confirmation-contact">
                <p><strong>${t('confirmation.contactAdmin')}:</strong></p>
                <p>Email: ${escapeHtml(window.APP_CONFIG?.admin_email || 'elysio.support@gmail.com')}</p>
              </div>
              
              <div class="confirmation-actions">
                ${textKey === 'pending_payment' ? `<a href="/payment/checkout?booking_id=${booking._id}" class="btn btn-primary">${t('booking.payNow')}</a>` : ''}
                <a href="/dashboard" data-link class="btn ${textKey === 'pending_payment' ? 'btn-outline' : 'btn-primary'}">${t('booking.viewMyBookings')}</a>
                <a href="/" data-link class="btn btn-outline">${t('common.backToHome')}</a>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      return `<div class="container"><p class="error">${t('booking.errorLoadingDetails')}</p></div>`;
    }
  },

  init() {}
};

export default BookingConfirmationPage;
