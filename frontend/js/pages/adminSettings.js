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
              <h2>${t('admin.regionalSettingsSection')}</h2>
              
              <div class="form-group">
                <label>${t('admin.currencyLabel')}</label>
                <select id="currency">
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="CUP">CUP - Cuban Peso</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>${t('admin.timezoneLabel')}</label>
                <select id="timezone">
                  <option value="UTC">UTC</option>
                  <option value="America/Havana">America/Havana</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/Madrid">Europe/Madrid</option>
                </select>
              </div>
            </div>
            
            <div class="form-section">
              <h2>${t('admin.paymentSettingsSection')}</h2>
              
              <div class="form-group">
                <label>${t('admin.paymentGatewayLabel')}</label>
                <select id="gateway">
                  <option value="qvapay">QvaPay</option>
                </select>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label>${t('admin.feeAmountLabel')}</label>
                  <input type="number" id="fee_amount" min="0" step="0.01" value="7">
                </div>
                <div class="form-group">
                  <label>${t('admin.feeCurrencyLabel')}</label>
                  <select id="fee_currency">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              
              <div class="form-group">
                <label>QvaPay App ID</label>
                <input type="text" id="qvapay_app_id" placeholder="${t('admin.leaveBlankHint')}">
              </div>
              
              <div class="form-group">
                <label>QvaPay App Secret</label>
                <input type="text" id="qvapay_app_secret" placeholder="${t('admin.leaveBlankHint')}">
              </div>
            </div>
            
            <div class="form-section">
              <h2>${t('admin.brandingSection')}</h2>
              
              <div class="form-group">
                <label>${t('admin.faviconUrlLabel')}</label>
                <input type="url" id="favicon_url" placeholder="https://...">
              </div>
            </div>
            
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
      currency: document.getElementById('currency')?.value,
      timezone: document.getElementById('timezone')?.value,
      gateway: document.getElementById('gateway')?.value,
      fee_amount: parseFloat(document.getElementById('fee_amount')?.value) || 7,
      fee_currency: document.getElementById('fee_currency')?.value,
      qvapay_app_id: document.getElementById('qvapay_app_id')?.value || undefined,
      qvapay_app_secret: document.getElementById('qvapay_app_secret')?.value || undefined,
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
