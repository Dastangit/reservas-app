import api from '../api.js';
import auth from '../auth.js';

const ReviewFormPage = {
  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Please <a href="/login" data-link>login</a> to submit a review.</p></div>';
    }

    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('booking_id');

    return `
      <div class="review-form-page">
        <div class="container">
          <h1>Write a Review</h1>
          
          <form id="review-form">
            <input type="hidden" id="booking-id" value="${bookingId || ''}">
            
            <div class="form-group">
              <label>Rating</label>
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
              <label>Your Review</label>
              <textarea id="review-text" rows="5" required placeholder="Tell us about your experience..."></textarea>
            </div>
            
            <div id="error-message" class="error-message" style="display:none;"></div>
            <div id="success-message" class="success-message" style="display:none;"></div>
            
            <button type="submit" class="btn btn-primary">Submit Review</button>
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
      errorEl.textContent = 'Please select a rating';
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
        successEl.textContent = 'Review submitted successfully!';
        successEl.style.display = 'block';
        errorEl.style.display = 'none';

        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to submit review';
      errorEl.style.display = 'block';
    }
  }
};

export default ReviewFormPage;
