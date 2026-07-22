import { formatDate, formatCurrency, getStatusColor } from '../utils/formatters.js';

const BookingCard = {
  render(booking, mode = 'tourist') {
    const property = booking.property_id;
    const statusColor = getStatusColor(booking.status);
    const isAdmin = mode === 'admin';
    const isHost = mode === 'host';

    return `
      <div class="booking-card" data-id="${booking._id}">
        <div class="booking-card-header">
          <h3>${property?.name || 'Property'}</h3>
          <span class="booking-status" style="background-color: ${statusColor}">
            ${booking.status.replace(/_/g, ' ').toUpperCase()}
          </span>
          <span class="booking-type-badge pre_booking">Pre-booking</span>
        </div>
        <div class="booking-card-body">
          <div class="booking-dates">
            <div class="booking-date">
              <strong>Check-in:</strong>
              <span>${formatDate(booking.check_in)}</span>
            </div>
            <div class="booking-date">
              <strong>Check-out:</strong>
              <span>${formatDate(booking.check_out)}</span>
            </div>
          </div>
          <div class="booking-info">
            <p><strong>Nights:</strong> ${booking.num_nights}</p>
            <p><strong>Guests:</strong> ${booking.num_guests}</p>
            <p><strong>Total:</strong> ${formatCurrency(booking.total_amount)}</p>
            <p><strong>Fee Paid:</strong> ${formatCurrency(booking.fee_amount)}</p>
          </div>
          ${booking.tourist_data ? `
            <div class="booking-tourist">
              <p><strong>Tourist:</strong> ${booking.tourist_data.name}</p>
              <p><strong>Contact:</strong> ${booking.tourist_data.email || booking.tourist_data.phone}</p>
            </div>
          ` : ''}
        </div>
        ${isAdmin ? `
          <div class="booking-card-actions">
            ${booking.status === 'pending_approval' ? `
              <button onclick="approveBooking('${booking._id}')" class="btn btn-success btn-sm">Approve</button>
              <button onclick="rejectBooking('${booking._id}')" class="btn btn-danger btn-sm">Reject</button>
            ` : ''}
            ${booking.status === 'approved' ? `
              <button onclick="completeBooking('${booking._id}')" class="btn btn-primary btn-sm">Mark Complete</button>
              <button onclick="notifyHostWhatsApp('${booking._id}')" class="btn btn-outline btn-sm">Notificar por WhatsApp</button>
            ` : ''}
          </div>
          <div class="tourist-contact-actions">
            <select id="tourist-msg-type-${booking._id}" class="tourist-msg-select">
              <option value="payment_received">Pago recibido</option>
              <option value="payment_reminder">Recordatorio de pago</option>
              <option value="booking_complete">Confirmación completa</option>
            </select>
            <button onclick="notifyTouristWhatsApp('${booking._id}')" class="btn btn-outline btn-sm">WhatsApp turista</button>
            <button onclick="notifyTouristEmail('${booking._id}')" class="btn btn-outline btn-sm">Correo turista</button>
          </div>
        ` : ''}
        ${isHost && booking.status === 'approved' ? `
          <div class="booking-card-actions">
            <button onclick="completeBooking('${booking._id}')" class="btn btn-primary btn-sm">Mark Complete</button>
          </div>
        ` : ''}
      </div>
    `;
  },

  renderList(bookings, mode = 'tourist') {
    if (!bookings || bookings.length === 0) {
      return '<p class="no-results">No bookings found</p>';
    }
    return bookings.map(b => this.render(b, mode)).join('');
  }
};

export default BookingCard;
