import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const LoginPage = {
  meta() {
    return { title: i18n.t('seo.login.title'), description: i18n.t('seo.login.description') };
  },

  pendingToken: null,

  render() {
    const t = (key) => i18n.t(key);
    return `
      <div class="auth-page">
        <div class="auth-container">
          <div class="auth-card">
            <h1>${t('auth.loginTitle')}</h1>
            <p class="auth-subtitle">${t('auth.loginSubtitle')}</p>
            
            <form id="login-form">
              <div class="form-group">
                <label for="email">${t('auth.email')}</label>
                <input type="email" id="email" required placeholder="your@email.com">
              </div>
              
              <div class="form-group">
                <label for="password">${t('auth.password')}</label>
                <div class="password-field">
                  <input type="password" id="password" required placeholder="Enter your password">
                  <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('password')" aria-label="${t('auth.showPassword')}">👁️</button>
                </div>
              </div>

              <p style="text-align:right;margin-bottom:15px;"><a href="/forgot-password" data-link style="font-size:var(--fs-sm);">${t('auth.forgotPassword')}</a></p>
              
              <div id="error-message" class="error-message" style="display:none;"></div>
              
              <button type="submit" class="btn btn-primary btn-block">${t('auth.loginTitle')}</button>
            </form>

            <form id="twofa-form" style="display:none;">
              <p>${t('auth.twoFactorPrompt')}</p>
              <div class="form-group">
                <label for="twofa-code">${t('auth.code')}</label>
                <input type="text" id="twofa-code" required placeholder="123456" autocomplete="one-time-code">
              </div>
              <div id="twofa-error-message" class="error-message" style="display:none;"></div>
              <button type="submit" class="btn btn-primary btn-block">${t('auth.verify')}</button>
            </form>
            
            <div class="auth-links">
              <p>${t('auth.noAccount')} <a href="/register" data-link>${t('common.register')}</a></p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('login-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin();
      });
    }

    const twofaForm = document.getElementById('twofa-form');
    if (twofaForm) {
      twofaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleTwoFactor();
      });
    }
  },

  completeLogin(data) {
    auth.setAuth(data.token, data.refresh_token, {
      id: data.user_id,
      role: data.role,
      tourist_onboarding: data.tourist_onboarding,
    });

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect') || '/';
    window.location.href = redirect;
  },

  async handleLogin() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const errorEl = document.getElementById('error-message');

    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.success && response.data.requires_2fa) {
        this.pendingToken = response.data.pending_token;
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('twofa-form').style.display = 'block';
        document.getElementById('twofa-code')?.focus();
        return;
      }

      if (response.success) {
        this.completeLogin(response.data);
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('auth.loginFailed');
      errorEl.style.display = 'block';
    }
  },

  async handleTwoFactor() {
    const code = document.getElementById('twofa-code')?.value?.trim();
    const errorEl = document.getElementById('twofa-error-message');

    try {
      const response = await api.post('/auth/verify-2fa', {
        pending_token: this.pendingToken,
        code,
      });

      if (response.success) {
        this.completeLogin(response.data);
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('auth.invalidCode');
      errorEl.style.display = 'block';
    }
  }
};

export default LoginPage;
