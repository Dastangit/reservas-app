import api from '../api.js';
import auth from '../auth.js';

const FeedbackFormPage = {
  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Please <a href="/login" data-link>login</a> to submit feedback.</p></div>';
    }

    return `
      <div class="feedback-form-page">
        <div class="container">
          <h1>Send Feedback</h1>
          <p>Help us improve Da-El World Travelers</p>
          
          <form id="feedback-form">
            <div class="form-group">
              <label>Category</label>
              <select id="category">
                <option value="other">Other</option>
                <option value="ux">User Experience</option>
                <option value="payment">Payment</option>
                <option value="communication">Communication</option>
                <option value="features">Feature Request</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Your Message</label>
              <textarea id="message" rows="5" required placeholder="Tell us what you think..."></textarea>
            </div>
            
            <div id="error-message" class="error-message" style="display:none;"></div>
            <div id="success-message" class="success-message" style="display:none;"></div>
            
            <button type="submit" class="btn btn-primary">Submit Feedback</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('feedback-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  },

  async handleSubmit() {
    const category = document.getElementById('category')?.value;
    const message = document.getElementById('message')?.value;
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');

    try {
      const response = await api.post('/feedback', { category, message });

      if (response.success) {
        successEl.textContent = 'Feedback submitted successfully!';
        successEl.style.display = 'block';
        errorEl.style.display = 'none';

        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to submit feedback';
      errorEl.style.display = 'block';
    }
  }
};

export default FeedbackFormPage;
