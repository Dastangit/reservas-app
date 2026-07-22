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

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
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

  isAdmin() {
    return this.getRole() === 'admin';
  },
};

export default auth;
