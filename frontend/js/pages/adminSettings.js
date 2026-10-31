import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const AdminSettingsPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-settings-page">
        <div class="container">
          <h1>${t('admin.settingsTitle')}</h1>
          
          <form id="settings-form">
            <div class="form-section">
              <h2>${t('admin.brandingSection')}</h2>
              
              <div class="form-group">
                <label>${t('admin.logoUrlLabel')}</label>
                <input type="url" id="logo_url" placeholder="https://...">
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label>${t('admin.primaryColorLabel')}</label>
                  <input type="color" id="primary_color" value="#2C5F8D">
                </div>
                <div class="form-group">
                  <label>${t('admin.secondaryColorLabel')}</label>
                  <input type="color" id="secondary_color" value="#F39C12">
                </div>
              </div>
            </div>
            
            <div class="form-section">
              <h2>${t('admin.languagesSection')}</h2>
              
              <div class="checkbox-group">
                <label><input type="checkbox" name="languages" value="en" checked> English</label>
                <label><input type="checkbox" name="languages" value="es" checked> Español</label>
                <label><input type="checkbox" name="languages" value="fr"> Français</label>
              </div>
              
              <div class="form-group">
                <label>${t('admin.defaultLanguageLabel')}</label>
                <select id="default_language">
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>
            
            <div class="form-section">
              <h2>${t('admin.contactSection')}</h2>
              <div class="form-group">
                <label>${t('admin.contactEmailLabel')}</label>
                <input type="email" id="admin_email">
              </div>
              <div class="form-group">
                <label>${t('admin.contactWhatsappLabel')}</label>
                <input type="tel" id="admin_whatsapp" placeholder="+53...">
              </div>
            </div>

            <div class="form-section">
              <h2>${t('admin.brandingSection')}</h2>
              <div class="form-group">
                <label>${t('admin.faviconUrlLabel')}</label>
                <input type="url" id="favicon_url" placeholder="https://...">
              </div>
            </div>

            <p class="field-hint">${t('admin.settingsPaymentNote')}</p>

            <div id="error-message" class="error-message" style="display:none;"></div>
            <div id="success-message" class="success-message" style="display:none;"></div>
            
            <button type="submit" class="btn btn-primary">${t('admin.saveSettingsBtn')}</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('settings-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSave();
      });
    }
    this.loadSettings();
  },

  // Carga los valores guardados: antes el formulario mostraba siempre valores
  // por defecto y al guardar los sobrescribia.
  async loadSettings() {
    try {
      const response = await api.get('/admin/settings');
      const settings = response.data?.settings || {};
      const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el && value !== undefined && value !== null && value !== '') el.value = value;
      };
      ['logo_url', 'favicon_url', 'primary_color', 'secondary_color', 'default_language', 'admin_email', 'admin_whatsapp']
        .forEach((id) => setValue(id, settings[id]));
      if (Array.isArray(settings.languages) && settings.languages.length) {
        document.querySelectorAll('input[name="languages"]').forEach((el) => {
          el.checked = settings.languages.includes(el.value);
        });
      }
    } catch (error) {
      const errorEl = document.getElementById('error-message');
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
      }
    }
  },

  async handleSave() {
    const languages = Array.from(document.querySelectorAll('input[name="languages"]:checked'))
      .map(el => el.value);

    const settings = {
      logo_url: document.getElementById('logo_url')?.value,
      primary_color: document.getElementById('primary_color')?.value,
      secondary_color: document.getElementById('secondary_color')?.value,
      favicon_url: document.getElementById('favicon_url')?.value,
      languages,
      default_language: document.getElementById('default_language')?.value,
      admin_email: document.getElementById('admin_email')?.value,
      admin_whatsapp: document.getElementById('admin_whatsapp')?.value,
    };

    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');

    try {
      const response = await api.put('/admin/settings', settings);

      if (response.success) {
        successEl.textContent = i18n.t('admin.settingsSaved');
        successEl.style.display = 'block';
        errorEl.style.display = 'none';
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('admin.settingsSaveFailed');
      errorEl.style.display = 'block';
    }
  }
};

export default AdminSettingsPage;
