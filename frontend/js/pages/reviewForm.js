import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const ReviewFormPage = {
  async render() {
    const t = (key) => i18n.t(key);
    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('review.loginPromptBefore')} <a href="/login" data-link>${t('common.login')}</a> ${t('review.loginPromptAfter')}</p></div>`;
    }

    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('booking_id');

    return `
      <div class="review-form-page">
        <div class="container">
          <h1>${t('review.title')}</h1>
          
          <form id="review-form">
            <input type="hidden" id="booking-id" value="${bookingId || ''}">
            
            <div class="form-group">
              <label>${t('review.rating')}</label>
              <div class="rating-input" id="rating-input">
                <span class="star" data-value="1">&#9733;</span>
                <span class="star" data-value="2">&#9733;</span>
                <span class="star" data-value="3">&#9733;</span>
                <span class="star" data-value="4">&#9733;</span>
                <span class="star" data-value="5">&#9733;</span>
              </div>
              <input type="hidden" id="rating" value="0">
            </div>
            
            <div class="form-group">
              <label>${t('review.yourReview')}</label>
              <textarea id="review-text" rows="5" required placeholder="${t('review.placeholder')}"></textarea>
            </div>
            
            <div id="error-message" class="error-message" style="display:none;"></div>
            <div id="success-message" class="success-message" style="display:none;"></div>
            
            <button type="submit" class="btn btn-primary">${t('review.submit')}</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    const stars = document.querySelectorAll('.star');
    const ratingInput = document.getElementById('rating');

    stars.forEach(star => {
      star.addEventListener('click', () => {
        const value = parseInt(star.dataset.value);
        ratingInput.value = value;

        stars.forEach((s, i) => {
          s.classList.toggle('active', i < value);
        });
      });
    });

    const form = document.getElementById('review-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  },

  async handleSubmit() {
    const bookingId = document.getElementById('booking-id')?.value;
    const rating = parseInt(document.getElementById('rating')?.value);
    const text = document.getElementById('review-text')?.value;
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');

    if (rating === 0) {
      errorEl.textContent = i18n.t('review.selectRating');
      errorEl.style.display = 'block';
      return;
    }

    try {
      const response = await api.post('/reviews', {
        booking_id: bookingId,
        rating,
        text,
      });

      if (response.success) {
        successEl.textContent = i18n.t('review.submitSuccess');
        successEl.style.display = 'block';
        errorEl.style.display = 'none';

        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('review.submitFailed');
      errorEl.style.display = 'block';
    }
  }
};

export default ReviewFormPage;
