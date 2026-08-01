import api from '../api.js';
import { passwordToggleButton } from '../utils/passwordToggle.js';

const ResetPasswordPage = {
  token: null,

  render() {
    const params = new URLSearchParams(window.location.search);
    this.token = params.get('token');

    if (!this.token) {
      return `
        <div class="auth-page">
          <div class="auth-container">
            <div class="auth-card">
              <h1>Link inv\u00e1lido</h1>
              <p class="auth-subtitle">Este link de restablecimiento no es v\u00e1lido. Solicita uno nuevo.</p>
              <div class="auth-links">
                <p><a href="/forgot-password" data-link>Solicitar nuevo link</a></p>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="auth-page">
        <div class="auth-container">
          <div class="auth-card">
            <h1>Nueva contrase\u00f1a</h1>
            <p class="auth-subtitle">Ingresa tu nueva contrase\u00f1a. Se cerrar\u00e1 sesi\u00f3n en todos tus dispositivos por seguridad.</p>

            <form id="reset-form">
              <div class="form-group">
                <label for="new-password">Nueva contrase\u00f1a</label>
                <div class="password-field-wrapper"><input type="password" id="new-password" required minlength="6" placeholder="M\u00ednimo 6 caracteres">
                  ${passwordToggleButton('new-password')}</div>
              </div>
              <div class="form-group">
                <label for="confirm-password">Confirmar contrase\u00f1a</label>
                <div class="password-field-wrapper"><input type="password" id="confirm-password" required minlength="6" placeholder="Repite la contrase\u00f1a">
                  ${passwordToggleButton('confirm-password')}</div>
              </div>

              <div id="error-message" class="error-message" style="display:none;"></div>

              <button type="submit" class="btn btn-primary btn-block" id="reset-submit">Actualizar contrase\u00f1a</button>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('reset-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  },

  async handleSubmit() {
    const newPassword = document.getElementById('new-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const errorEl = document.getElementById('error-message');
    const submitBtn = document.getElementById('reset-submit');

    errorEl.style.display = 'none';

    if (newPassword !== confirmPassword) {
      errorEl.textContent = 'Las contrase\u00f1as no coinciden.';
      errorEl.style.display = 'block';
      return;
    }

    try {
      submitBtn.disabled = true;
      const response = await api.post('/auth/reset-password', {
        token: this.token,
        new_password: newPassword,
      });

      if (response.success) {
        alert('Contrase\u00f1a actualizada. Ahora puedes iniciar sesi\u00f3n.');
        window.location.href = '/login';
      }
    } catch (error) {
      errorEl.textContent = error.message || 'El link puede haber expirado. Solicita uno nuevo.';
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  }
};

export default ResetPasswordPage;
