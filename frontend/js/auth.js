import api from './api.js';

const auth = {
  getToken() {
    return localStorage.getItem('token');
  },

  getRefreshToken() {
    return localStorage.getItem('refresh_token');
  },

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  setAuth(token, refreshToken, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
  },

  // Revoca el refresh token en el servidor (si falla, igual se cierra la sesion local).
  async logout() {
    if (this.getToken()) {
      await api.post('/auth/logout', {}).catch(() => {});
    }
    api.clearSession();
    window.location.href = '/';
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  getRole() {
    const user = this.getUser();
    return user ? user.role : null;
  },

  isTourist() {
    return this.getRole() === 'tourist';
  },

  isHost() {
    return this.getRole() === 'host';
  },

  isOrganizer() {
    return this.getRole() === 'organizer';
  },

  isAdmin() {
    return this.getRole() === 'admin';
  },

  getOnboarding() {
    return this.getUser()?.tourist_onboarding || {};
  },

  setOnboardingFlag(field, value) {
    const user = this.getUser();
    if (!user) return;
    user.tourist_onboarding = { ...user.tourist_onboarding, [field]: value };
    localStorage.setItem('user', JSON.stringify(user));
  },
};

export default auth;
