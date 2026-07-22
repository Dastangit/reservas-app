import api from '../api.js';
import auth from '../auth.js';

const LoginPage = {
  pendingToken: null,

  render() {
    return `
      <div class="auth-page">
        <div class="auth-container">
          <div class="auth-card">
            <h1>Login</h1>
            <p class="auth-subtitle">Welcome back to Da-El World Travelers</p>
            
            <form id="login-form">
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" required placeholder="your@email.com">
              </div>
              
              <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" required placeholder="Enter your password">
              </div>
              
              <div id="error-message" class="error-message" style="display:none;"></div>
              
              <button type="submit" class="btn btn-primary btn-block">Login</button>
            </form>

            <form id="twofa-form" style="display:none;">
              <p>Ingresa el código de 6 dígitos de tu app de autenticación (o un código de respaldo).</p>
              <div class="form-group">
                <label for="twofa-code">Código</label>
                <input type="text" id="twofa-code" required placeholder="123456" autocomplete="one-time-code">
              </div>
              <div id="twofa-error-message" class="error-message" style="display:none;"></div>
              <button type="submit" class="btn btn-primary btn-block">Verificar</button>
            </form>
            
            <div class="auth-links">
              <p>Don't have an account? <a href="/register" data-link>Sign up</a></p>
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
      errorEl.textContent = error.message || 'Login failed';
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
      errorEl.textContent = error.message || 'Invalid code';
      errorEl.style.display = 'block';
    }
  }
};

export default LoginPage;
