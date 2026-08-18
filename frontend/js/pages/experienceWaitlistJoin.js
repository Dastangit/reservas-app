import api from '../api.js';
import auth from '../auth.js';

const ExperienceWaitlistJoinPage = {
  experience: null,

  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Por favor <a href="/login" data-link>inicia sesión</a>.</p></div>';
    }

    const id = this._params?.id || window.location.pathname.split('/')[2];

    try {
      const response = await api.get(`/experiences/${id}`);
      this.experience = response.data?.experience;
    } catch (error) {
      return '<div class="container"><p class="error">Excursión no encontrada</p></div>';
    }

    if (!this.experience) {
      return '<div class="container"><p class="error">Excursión no encontrada</p></div>';
    }

    return `
      <div class="booking-form-page">
        <div class="container">
          <h1>Lista de espera: ${this.experience.title}</h1>
          <p style="color:var(--text-light);margin-bottom:20px;">
            Esta excursión no tiene cupos disponibles ahora mismo. Te avisaremos si se libera un cupo -- tendrás una ventana de tiempo limitada para confirmarlo.
          </p>

          <form id="waitlist-form" style="max-width:400px;">
            <div class="form-group">
              <label>Cantidad de cupos que necesitas</label>
              <input type="number" id="num-spots-requested" min="1" value="1" required>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary btn-block">Unirme a la lista de espera</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('waitlist-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleJoin();
      });
    }
  },

  async handleJoin() {
    const errorEl = document.getElementById('error-message');
    const num_spots_requested = parseInt(document.getElementById('num-spots-requested')?.value, 10);

    try {
      const response = await api.post(`/experiences/${this.experience._id}/waitlist`, { num_spots_requested });
      if (response.success) {
        alert(`Te uniste a la lista de espera en la posición #${response.data.position}. Te avisaremos si se libera un cupo.`);
        window.location.href = `/experiences/${this.experience._id}`;
      }
    } catch (error) {
      errorEl.textContent = error.message || 'No se pudo unir a la lista de espera';
      errorEl.style.display = 'block';
    }
  },
};

export default ExperienceWaitlistJoinPage;
