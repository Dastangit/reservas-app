import { formatDate, formatCurrency, getStatusColor } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';
import i18n from '../i18n.js';

const BookingCard = {
  render(booking, mode = 'tourist') {
    const t = (key) => i18n.t(key);
    const property = booking.property_id;
    const statusColor = getStatusColor(booking.status);
    const isAdmin = mode === 'admin';
    const isHost = mode === 'host';
    const statusKey = `bookingCard.status.${booking.status}`;
    const statusLabel = i18n.t(statusKey) === statusKey ? booking.status.replace(/_/g, ' ') : i18n.t(statusKey);

    return `
      <div class="booking-card" data-id="${booking._id}">
        <div class="booking-card-header">
          <h3>${escapeHtml(property?.name || t('bookingCard.property'))}</h3>
          <span class="booking-status" style="background-color: ${statusColor}">
            ${escapeHtml(statusLabel.toUpperCase())}
          </span>
          <span class="booking-type-badge pre_booking">${t('bookingCard.preBooking')}</span>
        </div>
        <div class="booking-card-body">
          <div class="booking-dates">
            <div class="booking-date">
              <strong>${t('bookingCard.checkIn')}:</strong>
              <span>${formatDate(booking.check_in)}</span>
            </div>
            <div class="booking-date">
              <strong>${t('bookingCard.checkOut')}:</strong>
              <span>${formatDate(booking.check_out)}</span>
            </div>
          </div>
          <div class="booking-info">
            <p><strong>${t('bookingCard.nights')}:</strong> ${booking.num_nights}</p>
            <p><strong>${t('bookingCard.guests')}:</strong> ${booking.num_guests}</p>
            <p><strong>${t('bookingCard.total')}:</strong> ${formatCurrency(booking.total_amount)}</p>
            <p><strong>${t('bookingCard.fee')}:</strong> ${formatCurrency(booking.fee_amount)} ${booking.fee_paid ? '&#10003;' : `(${t('bookingCard.feePending')})`}</p>
          </div>
          ${booking.tourist_data ? `
            <div class="booking-tourist">
              <p><strong>${t('bookingCard.tourist')}:</strong> ${escapeHtml(booking.tourist_data.name)}</p>
              <p><strong>${t('bookingCard.contact')}:</strong> ${escapeHtml(booking.tourist_data.email || booking.tourist_data.phone)}</p>
            </div>
          ` : ''}
        </div>
        ${isAdmin && booking.payment_method === 'paypal_manual' && (booking.payment_reference || booking.payer_email) ? `
          <div class="booking-payment-reference">
            <p><strong>${t('bookingCard.paypalRef')}:</strong> ${escapeHtml(booking.payment_reference || '-')}
              &middot; <strong>${t('bookingCard.payer')}:</strong> ${escapeHtml(booking.payer_email || '-')}</p>
          </div>
        ` : ''}
        ${isAdmin ? `
          <div class="booking-card-actions">
            ${booking.status === 'pending_payment' && booking.payment_method === 'paypal_manual' ? `
              <button onclick="confirmManualPayment('${booking._id}')" class="btn btn-success btn-sm">${t('bookingCard.confirmManualPayment')}</button>
            ` : ''}
            ${booking.status === 'pending_approval' ? `
              <button onclick="approveBooking('${booking._id}')" class="btn btn-success btn-sm">${t('admin.approveBtn')}</button>
              <button onclick="rejectBooking('${booking._id}')" class="btn btn-danger btn-sm">${t('admin.rejectBtn')}</button>
            ` : ''}
            ${booking.status === 'approved' ? `
              <button onclick="completeBooking('${booking._id}')" class="btn btn-primary btn-sm">${t('bookingCard.markComplete')}</button>
              <button onclick="notifyHostWhatsApp('${booking._id}')" class="btn btn-outline btn-sm">${t('bookingCard.whatsappHost')}</button>
            ` : ''}
          </div>
          <div class="tourist-contact-actions">
            <span class="contact-actions-label">${t('bookingCard.notifyTourist')}:</span>
            <select id="tourist-msg-type-${booking._id}" class="tourist-msg-select">
              <option value="payment_received">${t('bookingCard.msgPaymentReceived')}</option>
              <option value="payment_reminder">${t('bookingCard.msgPaymentReminder')}</option>
              <option value="booking_complete">${t('bookingCard.msgBookingComplete')}</option>
            </select>
            <button onclick="notifyTouristWhatsApp('${booking._id}')" class="btn btn-outline btn-sm">${t('bookingCard.whatsappTourist')}</button>
            <button onclick="notifyTouristEmail('${booking._id}')" class="btn btn-outline btn-sm">${t('bookingCard.emailTourist')}</button>
          </div>
        ` : ''}
        ${isHost && booking.status === 'approved' ? `
          <div class="booking-card-actions">
            <button onclick="completeBooking('${booking._id}')" class="btn btn-primary btn-sm">${t('bookingCard.markComplete')}</button>
          </div>
        ` : ''}
      </div>
    `;
  },

  renderList(bookings, mode = 'tourist') {
    if (!bookings || bookings.length === 0) {
      return `<p class="no-results">${i18n.t('bookingCard.noBookings')}</p>`;
    }
    return bookings.map(b => this.render(b, mode)).join('');
  }
};

export default BookingCard;
