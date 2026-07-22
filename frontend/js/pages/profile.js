import api from '../api.js';
import auth from '../auth.js';

const ProfilePage = {
  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Please <a href="/login" data-link>login</a> to view your profile.</p></div>';
    }

    const user = auth.getUser();

    return `
      <div class="profile-page">
        <div class="container">
          <h1>My Profile</h1>
          
          <div class="profile-card">
            <form id="profile-form">
              <div class="form-group">
                <label>Name</label>
                <input type="text" id="name" value="${user?.name || ''}" required>
              </div>
              
              <div class="form-group">
                <label>Email</label>
                <input type="email" id="email" value="${user?.email || ''}" disabled>
              </div>
              
              <div class="form-group">
                <label>Phone</label>
                <input type="tel" id="phone" value="${user?.phone || ''}">
              </div>
              
              <div class="form-group">
                <label>Role</label>
                <input type="text" value="${user?.role || ''}" disabled>
              </div>
              
              <div id="error-message" class="error-message" style="display:none;"></div>
              <div id="success-message" class="success-message" style="display:none;"></div>
              
              <button type="submit" class="btn btn-primary">Save Changes</button>
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
    const phone = document.getElementById('phone')?.value;
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');

    try {
      const response = await api.put('/users/profile', { name, phone });

      if (response.success) {
        successEl.textContent = 'Profile updated successfully!';
        successEl.style.display = 'block';
        errorEl.style.display = 'none';

        const user = auth.getUser();
        auth.setAuth(auth.getToken(), auth.getRefreshToken(), { ...user, name, phone });
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to update profile';
      errorEl.style.display = 'block';
    }
  }
};

export default ProfilePage;
