import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { escapeHtml } from '../utils/escape.js';
import { sanitizePhone, validateInternationalPhone } from '../utils/validators.js';
import { fetchProfile } from '../utils/contactPhone.js';

const HostProfilePage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isHost()) {
      return `<div class="container"><p>${t('host.accessDenied')}</p></div>`;
    }

    // La sesion guardada no trae el telefono: se lee del servidor.
    const user = { ...auth.getUser(), ...(await fetchProfile()) };
    const needsPhone = !user.phone;

    return `
      <div class="profile-page">
        <div class="container">
          <h1>${t('profile.hostTitle')}</h1>

          ${needsPhone ? `<div class="phone-required-notice" role="alert">${t('profile.phoneRequiredNotice')}</div>` : ''}

          <div class="profile-card">
            <form id="profile-form">
              <div class="form-group">
                <label>${t('profile.name')}</label>
                <input type="text" id="name" value="${escapeHtml(user?.name || '')}" required>
              </div>

              <div class="form-group">
                <label>${t('auth.email')}</label>
                <input type="email" id="email" value="${escapeHtml(user?.email || '')}" disabled>
              </div>

              <div class="form-group">
                <label for="phone">${t('auth.phone')}</label>
                <input type="tel" id="phone" value="${escapeHtml(user?.phone || '')}" required autocomplete="tel" placeholder="${t('auth.phonePlaceholder')}" ${needsPhone ? 'autofocus' : ''}>
                <small class="field-hint">${t('auth.phoneHint')}</small>
              </div>

              <div class="form-group">
                <label for="whatsapp">${t('profile.whatsapp')}</label>
                <input type="tel" id="whatsapp" value="${escapeHtml(user?.whatsapp_phone || '')}" placeholder="+34 600 000 000">
              </div>

              <div id="error-message" class="error-message" style="display:none;"></div>
              <div id="success-message" class="success-message" style="display:none;"></div>

              <button type="submit" class="btn btn-primary">${t('profile.saveChanges')}</button>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('profile-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSave();
      });
    }
  },

  async handleSave() {
    const name = document.getElementById('name')?.value;
    const phone = sanitizePhone(document.getElementById('phone')?.value?.trim());
    const whatsappPhone = sanitizePhone(document.getElementById('whatsapp')?.value?.trim());
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');

    if (!validateInternationalPhone(phone) || (whatsappPhone && !validateInternationalPhone(whatsappPhone))) {
      errorEl.textContent = i18n.t('auth.phoneInvalid');
      errorEl.style.display = 'block';
      successEl.style.display = 'none';
      return;
    }

    try {
      const response = await api.put('/users/profile', { name, phone, whatsapp_phone: whatsappPhone });

      if (response.success) {
        successEl.textContent = i18n.t('profile.updateSuccess');
        successEl.style.display = 'block';
        errorEl.style.display = 'none';
        document.querySelector('.phone-required-notice')?.remove();

        const user = auth.getUser();
        auth.setAuth(auth.getToken(), auth.getRefreshToken(), { ...user, name, phone, whatsapp_phone: whatsappPhone });
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('profile.updateFailed');
      errorEl.style.display = 'block';
    }
  }
};

export default HostProfilePage;
