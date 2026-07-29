import api from '../api.js';

const ForgotPasswordPage = {
  render() {
    return `
      <div class="auth-page">
        <div class="auth-container">
          <div class="auth-card">
            <h1>\u00bfOlvidaste tu contrase\u00f1a?</h1>
            <p class="auth-subtitle">Ingresa tu email. Un administrador se pondr\u00e1 en contacto contigo con instrucciones para restablecerla.</p>

            <form id="forgot-form">
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" required placeholder="tu@email.com">
              </div>

              <div id="error-message" class="error-message" style="display:none;"></div>
              <div id="success-message" class="success-message" style="display:none;"></div>

              <button type="submit" class="btn btn-primary btn-block" id="forgot-submit">Enviar solicitud</button>
            </form>

            <div class="auth-links">
              <p><a href="/login" data-link>Volver a iniciar sesi\u00f3n</a></p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('forgot-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  },

  async handleSubmit() {
    const email = document.getElementById('email')?.value;
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');
    const submitBtn = document.getElementById('forgot-submit');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    try {
      submitBtn.disabled = true;
      const response = await api.post('/auth/forgot-password', { email });
      if (response.success) {
        successEl.textContent = 'Si ese email est\u00e1 registrado, nuestro equipo te contactar\u00e1 pronto por WhatsApp o correo con instrucciones para restablecer tu contrase\u00f1a.';
        successEl.style.display = 'block';
        document.getElementById('forgot-form').reset();
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Ocurri\u00f3 un error, intenta de nuevo.';
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  }
};

export default ForgotPasswordPage;
