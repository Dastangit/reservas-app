const Footer = {
  render() {
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <div class="footer-logo-row">
                <img src="/assets/logo.png" alt="Da-El World Travelers" class="footer-logo-img">
              </div>
              <p>Viaja con confianza</p>
              <p class="footer-contact">
                <strong>Contact:</strong><br>
                Email: supportdaelworld@gmail.com
              </p>
            </div>
            <div class="footer-links">
              <h4>Quick Links</h4>
              <a href="/search" data-link>Search Properties</a>
              <a href="/how-it-works" data-link>How It Works</a>
              <a href="/faq" data-link>FAQ</a>
              <a href="/feedback" data-link>Send Feedback</a>
            </div>
            <div class="footer-legal">
              <h4>Legal</h4>
              <a href="/terms" data-link>Terms of Service</a>
              <a href="/privacy" data-link>Privacy Policy</a>
            </div>
            <div class="footer-social">
              <h4>Follow Us</h4>
              <div class="social-icons">
                <a href="https://instagram.com/daelworldtravelers" target="_blank" aria-label="Instagram">Instagram</a>
                <a href="https://facebook.com/daelworldtravelers" target="_blank" aria-label="Facebook">Facebook</a>
              </div>
            </div>
          </div>
          <div class="footer-bottom">
            <p>&copy; ${new Date().getFullYear()} Da-El World Travelers. All rights reserved.</p>
          </div>
        </div>
      </footer>
    `;
  },

  init() {
    const footerEl = document.getElementById('footer');
    if (footerEl) {
      footerEl.innerHTML = this.render();
    }
  }
};

export default Footer;
