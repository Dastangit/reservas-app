const sgMail = require('@sendgrid/mail');
const env = require('../config/env');

sgMail.setApiKey(env.sendgrid.apiKey);

const sendEmail = async ({ to, subject, html }) => {
  const msg = {
    to,
    from: env.sendgrid.fromEmail,
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email error:', error.response?.body || error.message);
    return false;
  }
};

const sendBookingConfirmation = async (touristEmail, booking, property) => {
  const html = `
    <h1>Booking Confirmation</h1>
    <p>Your booking has been created and is pending approval.</p>
    <h2>Booking Details:</h2>
    <ul>
      <li><strong>Property:</strong> ${property.name}</li>
      <li><strong>Check-in:</strong> ${new Date(booking.check_in).toLocaleDateString()}</li>
      <li><strong>Check-out:</strong> ${new Date(booking.check_out).toLocaleDateString()}</li>
      <li><strong>Total nights:</strong> ${booking.num_nights}</li>
      <li><strong>Fee paid:</strong> $${booking.fee_amount} USD</li>
    </ul>
    <p>You will receive another email when your booking is approved.</p>
  `;

  return sendEmail({ to: touristEmail, subject: 'Booking Confirmation - Da-El World Travelers', html });
};

const sendBookingApproved = async (touristEmail, booking, property) => {
  const html = `
    <h1>Booking Approved!</h1>
    <p>Your booking has been approved by the administrator.</p>
    <h2>Booking Details:</h2>
    <ul>
      <li><strong>Property:</strong> ${property.name}</li>
      <li><strong>Check-in:</strong> ${new Date(booking.check_in).toLocaleDateString()}</li>
      <li><strong>Check-out:</strong> ${new Date(booking.check_out).toLocaleDateString()}</li>
    </ul>
    <p>Please contact the host to arrange payment and check-in details.</p>
  `;

  return sendEmail({ to: touristEmail, subject: 'Booking Approved - Da-El World Travelers', html });
};

const sendBookingRejected = async (touristEmail, booking, reason) => {
  const html = `
    <h1>Booking Rejected</h1>
    <p>We're sorry, but your booking has been rejected.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>If you have questions, please contact the administrator.</p>
  `;

  return sendEmail({ to: touristEmail, subject: 'Booking Rejected - Da-El World Travelers', html });
};

// Notifica al anfitrión cuando una reserva de la plataforma es aprobada.
const sendHostBookingNotification = async (hostEmail, booking, property) => {
  const html = `
    <h1>Nueva reserva confirmada</h1>
    <p>Tienes una nueva reserva aprobada a través de la plataforma.</p>
    <h2>Detalles de la reserva:</h2>
    <ul>
      <li><strong>Propiedad:</strong> ${property.name}</li>
      <li><strong>Check-in:</strong> ${new Date(booking.check_in).toLocaleDateString()}</li>
      <li><strong>Check-out:</strong> ${new Date(booking.check_out).toLocaleDateString()}</li>
      <li><strong>Huéspedes:</strong> ${booking.num_guests}</li>
      <li><strong>Total a cobrar en el alojamiento:</strong> $${booking.total_amount} USD</li>
    </ul>
    <p>Recuerda que estas fechas ya quedaron reflejadas en tu calendario de disponibilidad.</p>
  `;

  return sendEmail({ to: hostEmail, subject: 'Nueva reserva confirmada - Da-El World Travelers', html });
};

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendBookingApproved,
  sendBookingRejected,
  sendHostBookingNotification,
};
