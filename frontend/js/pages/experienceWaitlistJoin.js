import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const ExperienceWaitlistJoinPage = {
  experience: null,

  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('experience.loginRequiredSimple')}</p></div>`;
    }

    const id = this._params?.id || window.location.pathname.split('/')[2];

    try {
      const response = await api.get(`/experiences/${id}`);
      this.experience = response.data?.experience;
    } catch (error) {
      return `<div class="container"><p class="error">${t('experience.notFound')}</p></div>`;
    }

    if (!this.experience) {
      return `<div class="container"><p class="error">${t('experience.notFound')}</p></div>`;
    }

    return `
      <div class="booking-form-page">
        <div class="container">
          <h1>${t('experience.waitlistTitlePrefix')} ${this.experience.title}</h1>
          <p style="color:var(--text-light);margin-bottom:20px;">
            ${t('experience.waitlistIntro')}
          </p>

          <form id="waitlist-form" style="max-width:400px;">
            <div class="form-group">
              <label>${t('experience.spotsNeededLabel')}</label>
              <input type="number" id="num-spots-requested" min="1" value="1" required>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary btn-block">${t('experience.waitlistSubmitBtn')}</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('waitlist-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleJoin();
      });
    }
  },

  async handleJoin() {
    const errorEl = document.getElementById('error-message');
    const num_spots_requested = parseInt(document.getElementById('num-spots-requested')?.value, 10);

    try {
      const response = await api.post(`/experiences/${this.experience._id}/waitlist`, { num_spots_requested });
      if (response.success) {
        alert(`${i18n.t('experience.joinedWaitlistPrefix')}${response.data.position}${i18n.t('experience.joinedWaitlistSuffix')}`);
        window.location.href = `/experiences/${this.experience._id}`;
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('experience.joinWaitlistFailed');
      errorEl.style.display = 'block';
    }
  },
};

export default ExperienceWaitlistJoinPage;
