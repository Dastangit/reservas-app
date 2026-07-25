// SendGrid fue eliminado del proyecto: estaba bloqueado/restringido para
// Cuba de todas formas, la API key nunca se configur\u00f3 con un valor real, y
// depend\u00eda de axios con m\u00faltiples CVEs de severidad alta (ver npm audit).
// La arquitectura de comunicaci\u00f3n oficial es 100% wa.me/mailto manual desde
// el panel admin (ver adminController.getBookingTouristContactLinks, etc.).
//
// Estas funciones se dejan como no-ops (mismos nombres y firmas) para que
// bookingController.js, adminController.js y contactController.js no
// necesiten tocarse -- simplemente ya no hacen nada, en vez de fallar en
// silencio como pasaba antes con la API key placeholder.

const sendEmail = async ({ to, subject }) => {
  console.log(`[Email deshabilitado] Se habr\u00eda enviado "${subject}" a ${to} -- usar wa.me/mailto manual en su lugar.`);
  return false;
};

const sendBookingConfirmation = async (touristEmail) => sendEmail({ to: touristEmail, subject: 'Booking Confirmation' });

const sendBookingApproved = async (touristEmail) => sendEmail({ to: touristEmail, subject: 'Booking Approved' });

const sendBookingRejected = async (touristEmail) => sendEmail({ to: touristEmail, subject: 'Booking Rejected' });

const sendHostBookingNotification = async (hostEmail) => sendEmail({ to: hostEmail, subject: 'Nueva reserva confirmada' });

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendBookingApproved,
  sendBookingRejected,
  sendHostBookingNotification,
};
