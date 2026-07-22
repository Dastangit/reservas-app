import api from '../api.js';
import auth from '../auth.js';

const AdminFeedbackPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-feedback-page">
        <div class="container">
          <h1>Feedback Management</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="new">New</button>
            <button class="tab-btn" data-tab="responded">Responded</button>
            <button class="tab-btn" data-tab="all">All</button>
          </div>
          
          <div id="feedback-list">
            <p class="loading">Loading feedback...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.loadFeedback(e.target.dataset.tab);
      });
    });

    await this.loadFeedback('new');

    window.respondToFeedback = async (id) => {
      const response = prompt('Enter your response:');
      if (response) {
        try {
          await api.post(`/feedback/${id}/respond`, { response });
          alert('Response sent');
          this.loadFeedback('new');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    };
  },

  async loadFeedback(filter = 'all') {
    const list = document.getElementById('feedback-list');
    if (!list) return;

    list.innerHTML = '<p class="loading">Loading...</p>';

    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await api.get(`/feedback${params}`);
      const feedback = response.data?.feedback || [];

      if (feedback.length === 0) {
        list.innerHTML = '<p class="no-results">No feedback found</p>';
        return;
      }

      list.innerHTML = feedback.map(f => `
        <div class="feedback-item">
          <div class="feedback-header">
            <span class="feedback-category">${f.category}</span>
            <span class="feedback-status ${f.status}">${f.status}</span>
          </div>
          <p class="feedback-message">${f.message}</p>
          <p class="feedback-user">From: ${f.user_id?.name || 'Unknown'} | ${new Date(f.created_at).toLocaleDateString()}</p>
          ${f.admin_response ? `
            <div class="feedback-response">
              <strong>Admin Response:</strong>
              <p>${f.admin_response}</p>
            </div>
          ` : `
            <button onclick="respondToFeedback('${f._id}')" class="btn btn-primary btn-sm">Respond</button>
          `}
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error loading feedback</p>';
    }
  }
};

export default AdminFeedbackPage;
