const API_URL = window.location.hostname === 'localhost' || window.location.hostname.match(/^(192\.168\.|10\.|172\.)/)
  ? `http://${window.location.hostname}:3000/api`
  : '/api';

// Rutas de auth que nunca deben disparar un refresco automatico (evita bucles).
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/verify-2fa', '/auth/logout'];

let refreshPromise = null;

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

// Pide un token nuevo con el refresh token. Varias peticiones que fallan a la
// vez comparten la misma renovacion (el backend rota el refresh token).
async function refreshSession() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const data = await response.json();
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('refresh_token', data.data.refresh_token);
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// Sesion vencida y sin posibilidad de renovarla: se limpia y se manda al login.
function redirectToLogin() {
  clearSession();
  const here = window.location.pathname + window.location.search;
  if (!window.location.pathname.endsWith('/login')) {
    window.location.href = `/login?redirect=${encodeURIComponent(here)}`;
  }
}

async function parseBody(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// Mensaje de error legible: el backend manda `error` y, en validaciones, `errors[]`.
function errorMessage(data, response) {
  if (data && data.error) return data.error;
  if (data && Array.isArray(data.errors) && data.errors.length) {
    return data.errors.map((e) => e.message).join('. ');
  }
  if (response && response.status >= 500) return 'The server is not responding right now. Please try again in a minute.';
  return 'Request failed';
}

async function send(endpoint, buildInit, { retried = false } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, buildInit(localStorage.getItem('token')));
  } catch (error) {
    // Sin red o backend dormido (Render tarda en despertar).
    throw new Error('Network error. Check your connection and try again.');
  }

  if (response.status === 401 && !retried && !NO_REFRESH_PATHS.includes(endpoint)
    && localStorage.getItem('refresh_token')) {
    const refreshed = await refreshSession();
    if (refreshed) return send(endpoint, buildInit, { retried: true });
    redirectToLogin();
  }

  const data = await parseBody(response);
  if (!response.ok) {
    const error = new Error(errorMessage(data, response));
    error.status = response.status;
    error.code = data.code;
    error.details = data.errors;
    throw error;
  }
  return data;
}

const api = {
  async request(endpoint, options = {}) {
    try {
      return await send(endpoint, (token) => ({
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      }));
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint);
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  // Subida de archivos (FormData) -- NO se fuerza Content-Type: el navegador
  // arma el boundary de multipart/form-data solo si no se lo pisamos.
  async uploadFile(endpoint, file, fieldName = 'image') {
    return send(endpoint, (token) => {
      const formData = new FormData();
      formData.append(fieldName, file);
      return {
        method: 'POST',
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        body: formData,
      };
    });
  },

  clearSession,
};

export default api;
