import api from '../api.js';
import auth from '../auth.js';

const ExperienceBookingConfirmationPage = {
  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Por favor <a href="/login" data-link>inicia sesión</a>.</p></div>';
    }

    const id = this._params?.bookingId || window.location.pathname.split('/')[2];

    try {
      const response = await api.get(`/experience-bookings/${id}`);
      const booking = response.data?.booking;

      if (!booking) {
        return '<div class="container"><p class="error">Reserva no encontrada</p></div>';
      }

      const hoursLeft = Math.max(0, Math.round((new Date(booking.hold_expires_at) - new Date()) / (1000 * 60 * 60)));

      return `
        <div class="confirmation-page">
          <div class="container">
            <div class="confirmation-card">
              <h1>¡Solicitud de reserva enviada!</h1>
              <p class="confirmation-subtitle">Reservaste ${booking.num_spots} cupo(s) en "${booking.experience_id?.title || 'la excursión'}"</p>

              <div class="confirmation-details">
                <h2>¿Qué sigue?</h2>
                <p>No pagaste nada por reservar. Tu solicitud está pendiente de aprobación del admin -- tienes una ventana de aproximadamente ${hoursLeft}h más para que se apruebe, o los cupos se liberan automáticamente.</p>
                <p>Una vez aprobada, recibirás el contacto del organizador para coordinar el pago del servicio y los detalles del punto de encuentro.</p>
              </div>

              <a href="/experience-bookings" data-link class="btn btn-primary">Ver mis reservas de excursiones</a>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      return '<div class="container"><p class="error">No se pudo cargar la reserva</p></div>';
    }
  },

  init() {},
};

export default ExperienceBookingConfirmationPage;
