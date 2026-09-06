import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { passwordToggleButton } from '../utils/passwordToggle.js';

const RegisterPage = {
  render() {
    const t = (key) => i18n.t(key);
    const params = new URLSearchParams(window.location.search);
    const defaultRole = params.get('role') || 'tourist';

    return `
      <div class="auth-page">
        <div class="auth-container">
          <div class="auth-card">
            <h1>${t('auth.registerTitle')}</h1>
            <p class="auth-subtitle">${t('auth.registerSubtitle')}</p>

            <form id="register-form">
              <div class="form-group">
                <label for="name">${t('auth.name')}</label>
                <input type="text" id="name" required placeholder="John Doe">
              </div>

              <div class="form-group">
                <label for="email">${t('auth.email')}</label>
                <input type="email" id="email" required placeholder="your@email.com">
              </div>

              <div class="form-group">
                <label for="password">${t('auth.password')}</label>
                <div class="password-field-wrapper">
                  <input type="password" id="password" required placeholder="Min 6 characters" minlength="6">
                  ${passwordToggleButton('password')}
                </div>
              </div>

              <div class="form-group">
                <label for="phone">${t('auth.phone')}</label>
                <input type="tel" id="phone" placeholder="+1 234 567 890">
                <small class="field-hint" id="phone-hint" style="display:none;">${t('auth.phoneHint')}</small>
              </div>

              <div class="form-group">
                <label for="role">${t('auth.role')}</label>
                <select id="role">
                  <option value="tourist" ${defaultRole === 'tourist' ? 'selected' : ''}>${t('auth.bookAccommodations')}</option>
                  <option value="host" ${defaultRole === 'host' ? 'selected' : ''}>${t('auth.listProperty')}</option>
                  <option value="organizer" ${defaultRole === 'organizer' ? 'selected' : ''}>${t('auth.organizeExcursions')}</option>
                </select>
              </div>

              <div id="error-message" class="error-message" style="display:none;"></div>

              <button type="submit" class="btn btn-primary btn-block">${t('auth.registerTitle')}</button>
            </form>

            <div class="auth-links">
              <p>${t('auth.hasAccount')} <a href="/login" data-link>${t('common.login')}</a></p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('register-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRegister();
      });
    }

    const roleSelect = document.getElementById('role');
    const phoneInput = document.getElementById('phone');
    const phoneHint = document.getElementById('phone-hint');
    const toggleOrganizerPhone = () => {
      const isOrganizer = roleSelect?.value === 'organizer';
      if (phoneInput) phoneInput.required = isOrganizer;
      if (phoneHint) phoneHint.style.display = isOrganizer ? 'block' : 'none';
    };
    if (roleSelect) {
      roleSelect.addEventListener('change', toggleOrganizerPhone);
      toggleOrganizerPhone();
    }
  },

  async handleRegister() {
    const name = document.getElementById('name')?.value;
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const phone = document.getElementById('phone')?.value;
    const role = document.getElementById('role')?.value;
    const errorEl = document.getElementById('error-message');

    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        phone,
        role,
      });

      if (response.success) {
        auth.setAuth(response.data.token, response.data.refresh_token, {
          id: response.data.user_id,
          role: response.data.role,
          name,
          tourist_onboarding: response.data.tourist_onboarding,
        });

        window.location.href = role === 'host' ? '/host/dashboard' : role === 'organizer' ? '/organizer/dashboard' : '/dashboard';
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('auth.registrationFailed');
      errorEl.style.display = 'block';
    }
  }
};

export default RegisterPage;
