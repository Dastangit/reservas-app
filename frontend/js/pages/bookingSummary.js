import api from '../api.js';
import { formatCurrency, formatDate, getStatusColor } from '../utils/formatters.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const BookingSummaryPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('booking.loginRequiredView')}</p></div>`;
    }

    const bookingId = this._params?.id;

    try {
      const response = await api.get(`/bookings/${bookingId}`);
      const booking = response.data?.booking;

      if (!booking) {
        return `<div class="container"><p class="error">${t('booking.bookingNotFound')}</p></div>`;
      }

      const statusColor = getStatusColor(booking.status);

      return `
        <div class="booking-summary-page">
          <div class="container">
            <h1>${t('booking.detailsTitle')}</h1>
            
            <div class="booking-detail-card">
              <div class="booking-header">
                <h2>${booking.property_id?.name || t('booking.propertyFallback')}</h2>
                <span class="status-badge" style="background-color: ${statusColor}">
                  ${this.statusLabel(booking.status)}
                </span>
              </div>
              
              <div class="booking-body">
                <div class="detail-section">
                  <h3>${t('booking.dates')}</h3>
                  <p><strong>${t('booking.checkIn')}:</strong> ${formatDate(booking.check_in)}</p>
                  <p><strong>${t('booking.checkOut')}:</strong> ${formatDate(booking.check_out)}</p>
                  <p><strong>${t('booking.nights')}:</strong> ${booking.num_nights}</p>
                </div>
                
                <div class="detail-section">
                  <h3>${t('booking.guests')}</h3>
                  <p>${booking.num_guests} ${t('booking.guestWord')}</p>
                </div>
                
                <div class="detail-section">
                  <h3>${t('booking.payment')}</h3>
                  <p><strong>${t('booking.totalAmount')}</strong> ${formatCurrency(booking.total_amount)}</p>
                  <p><strong>${t('booking.feePaid')}</strong> ${formatCurrency(booking.fee_amount)}</p>
                  <p><strong>${t('booking.paymentOption')}</strong> ${booking.payment_option === 'full_payment' ? t('booking.fullPayment') : t('booking.dailyPayment')}</p>
                  ${booking.status === 'pending_payment' ? `<p><strong>${t('booking.paymentStatus')}</strong> ${this.paymentStageLabel(booking.payment_stage)}</p>` : ''}
                </div>
                
                <div class="detail-section">
                  <h3>${t('booking.contactInfo')}</h3>
                  <p><strong>${t('auth.name')}:</strong> ${booking.tourist_data?.name || 'N/A'}</p>
                  <p><strong>${t('auth.email')}:</strong> ${booking.tourist_data?.email || 'N/A'}</p>
                  <p><strong>${t('booking.phoneLabel').replace(' (WhatsApp) *', '')}:</strong> ${booking.tourist_data?.phone || 'N/A'}</p>
                </div>
                
                ${booking.status === 'pending_approval' || booking.status === 'pending_payment' ? `
                  <div class="booking-actions">
                    <button onclick="cancelBooking('${booking._id}')" class="btn btn-danger">${t('booking.cancelBookingBtn')}</button>
                  </div>
                ` : ''}
                
                ${booking.status === 'completed' ? `
                  <div class="booking-actions">
                    <a href="/review?booking_id=${booking._id}" data-link class="btn btn-primary">${t('booking.writeReview')}</a>
                  </div>
                ` : ''}
              </div>
              
              <div class="booking-contact">
                <h3>${t('confirmation.contactAdmin')}</h3>
                <p>Email: elysio.support@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      return `<div class="container"><p class="error">${t('booking.errorLoadingDetails')}</p></div>`;
    }
  },

  init() {
    window.cancelBooking = async (bookingId) => {
      if (confirm(i18n.t('booking.confirmCancel'))) {
        try {
          await api.post(`/bookings/${bookingId}/cancel`);
          alert(i18n.t('booking.cancelled'));
          window.location.href = '/dashboard';
        } catch (error) {
          alert(i18n.t('booking.cancelFailed') + error.message);
        }
      }
    };
  },

  statusLabel(status) {
    const key = {
      pending_payment: 'statusPendingPayment',
      pending_approval: 'statusPendingApproval',
      approved: 'statusApproved',
      rejected: 'statusRejected',
      completed: 'statusCompleted',
      cancelled: 'statusCancelled',
    }[status];
    return key ? i18n.t(`booking.${key}`) : status.replace(/_/g, ' ').toUpperCase();
  },

  paymentStageLabel(stage) {
    const key = {
      awaiting_payment: 'stageAwaitingPayment',
      waiting: 'stageWaiting',
      confirming: 'stageConfirming',
      sending: 'stageSending',
      partially_paid: 'stagePartiallyPaid',
      finished: 'stageFinished',
      failed: 'stageFailed',
      expired: 'stageExpired',
    }[stage];
    return key ? i18n.t(`booking.${key}`) : i18n.t('booking.stageAwaitingPayment');
  }
};

export default BookingSummaryPage;
