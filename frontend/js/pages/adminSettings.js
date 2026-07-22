import api from '../api.js';
import auth from '../auth.js';

const AdminSettingsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-settings-page">
        <div class="container">
          <h1>Settings</h1>
          
          <form id="settings-form">
            <div class="form-section">
              <h2>Branding</h2>
              
              <div class="form-group">
                <label>Logo URL</label>
                <input type="url" id="logo_url" placeholder="https://...">
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Primary Color</label>
                  <input type="color" id="primary_color" value="#2C5F8D">
                </div>
                <div class="form-group">
                  <label>Secondary Color</label>
                  <input type="color" id="secondary_color" value="#F39C12">
                </div>
              </div>
            </div>
            
            <div class="form-section">
              <h2>Languages</h2>
              
              <div class="checkbox-group">
                <label><input type="checkbox" name="languages" value="en" checked> English</label>
                <label><input type="checkbox" name="languages" value="es" checked> Spanish</label>
                <label><input type="checkbox" name="languages" value="fr"> French</label>
              </div>
              
              <div class="form-group">
                <label>Default Language</label>
                <select id="default_language">
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>
            
            <div class="form-section">
              <h2>Regional Settings</h2>
              
              <div class="form-group">
                <label>Currency</label>
                <select id="currency">
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="CUP">CUP - Cuban Peso</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Timezone</label>
                <select id="timezone">
                  <option value="UTC">UTC</option>
                  <option value="America/Havana">America/Havana</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/Madrid">Europe/Madrid</option>
                </select>
              </div>
            </div>
            
            <div class="form-section">
              <h2>Payment Settings</h2>
              
              <div class="form-group">
                <label>Payment Gateway</label>
                <select id="gateway">
                  <option value="nowpayments">NOWPayments</option>
                </select>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Fee Amount</label>
                  <input type="number" id="fee_amount" min="0" step="0.01" value="7">
                </div>
                <div class="form-group">
                  <label>Fee Currency</label>
                  <select id="fee_currency">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              
              <div class="form-group">
                <label>NOWPayments API Key</label>
                <input type="text" id="nowpayments_api_key" placeholder="Leave blank to keep current">
              </div>
              
              <div class="form-group">
                <label>NOWPayments IPN Key</label>
                <input type="text" id="nowpayments_ipn_key" placeholder="Leave blank to keep current">
              </div>
            </div>
            
            <div class="form-section">
              <h2>Branding</h2>
              
              <div class="form-group">
                <label>Favicon URL</label>
                <input type="url" id="favicon_url" placeholder="https://...">
              </div>
            </div>
            
            <div id="error-message" class="error-message" style="display:none;"></div>
            <div id="success-message" class="success-message" style="display:none;"></div>
            
            <button type="submit" class="btn btn-primary">Save Settings</button>
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
      nowpayments_api_key: document.getElementById('nowpayments_api_key')?.value || undefined,
      nowpayments_ipn_key: document.getElementById('nowpayments_ipn_key')?.value || undefined,
    };

    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');

    try {
      const response = await api.put('/admin/settings', settings);

      if (response.success) {
        successEl.textContent = 'Settings saved successfully!';
        successEl.style.display = 'block';
        errorEl.style.display = 'none';
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to save settings';
      errorEl.style.display = 'block';
    }
  }
};

export default AdminSettingsPage;
