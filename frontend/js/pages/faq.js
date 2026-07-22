const FAQPage = {
  render() {
    return `
      <div class="faq-page">
        <div class="container">
          <h1>${i18n.t('pages.faq.title')}</h1>
          <p class="subtitle">${i18n.t('pages.faq.subtitle')}</p>

          <div class="faq-list">
            <div class="faq-item">
              <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
                <span>${i18n.t('pages.faq.q1Question')}</span>
                <span class="faq-icon">+</span>
              </button>
              <div class="faq-answer">
                <p>${i18n.t('pages.faq.q1Answer')}</p>
                <ol>
                  <li>${i18n.t('pages.faq.q1Step1')}</li>
                  <li>${i18n.t('pages.faq.q1Step2')}</li>
                  <li>${i18n.t('pages.faq.q1Step3')}</li>
                  <li>${i18n.t('pages.faq.q1Step4')}</li>
                </ol>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
                <span>${i18n.t('pages.faq.q2Question')}</span>
                <span class="faq-icon">+</span>
              </button>
              <div class="faq-answer">
                <p>${i18n.t('pages.faq.q2Answer')}</p>
                <p>${i18n.t('pages.faq.q2Contact')}</p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
                <span>${i18n.t('pages.faq.q3Question')}</span>
                <span class="faq-icon">+</span>
              </button>
              <div class="faq-answer">
                <p>${i18n.t('pages.faq.q3Answer')}</p>
                <p>${i18n.t('pages.faq.q3Approved')}</p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
                <span>${i18n.t('pages.faq.q4Question')}</span>
                <span class="faq-icon">+</span>
              </button>
              <div class="faq-answer">
                <p>${i18n.t('pages.faq.q4Answer')}</p>
                <ul>
                  <li>${i18n.t('pages.faq.q4Usdt')}</li>
                  <li>${i18n.t('pages.faq.q4Btc')}</li>
                  <li>${i18n.t('pages.faq.q4Eth')}</li>
                </ul>
                <p>${i18n.t('pages.faq.q4Refund')}</p>
                <p>${i18n.t('pages.faq.q4Process')}</p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
                <span>${i18n.t('pages.faq.q5Question')}</span>
                <span class="faq-icon">+</span>
              </button>
              <div class="faq-answer">
                <p>${i18n.t('pages.faq.q5Answer')}</p>
                <ol>
                  <li>${i18n.t('pages.faq.q5Step1')}</li>
                  <li>${i18n.t('pages.faq.q5Step2')}</li>
                  <li>${i18n.t('pages.faq.q5Step3')}</li>
                  <li>${i18n.t('pages.faq.q5Step4')}</li>
                </ol>
                <p>${i18n.t('pages.faq.q5NoFee')}</p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
                <span>${i18n.t('pages.faq.q6Question')}</span>
                <span class="faq-icon">+</span>
              </button>
              <div class="faq-answer">
                <p>${i18n.t('pages.faq.q6Answer')}</p>
                <ul>
                  <li>${i18n.t('pages.faq.q6Verified')}</li>
                  <li>${i18n.t('pages.faq.q6Secure')}</li>
                  <li>${i18n.t('pages.faq.q6Data')}</li>
                  <li>${i18n.t('pages.faq.q6Isolation')}</li>
                  <li>${i18n.t('pages.faq.q6Reviews')}</li>
                </ul>
                <p>${i18n.t('pages.faq.q6Practice')}</p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
                <span>${i18n.t('pages.faq.q7Question')}</span>
                <span class="faq-icon">+</span>
              </button>
              <div class="faq-answer">
                <p>${i18n.t('pages.faq.q7Answer')}</p>
                <div class="faq-contact">
                  <p><strong>${i18n.t('pages.faq.q7DastanName')}</strong></p>
                  <ul>
                    <li>${i18n.t('pages.faq.q7DastanEmail')}</li>
                  </ul>
                </div>
                <p>${i18n.t('pages.faq.q7Feedback')}</p>
              </div>
            </div>

            <div class="faq-item">
              <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
                <span>${i18n.t('pages.faq.q8Question')}</span>
                <span class="faq-icon">+</span>
              </button>
              <div class="faq-answer">
                <p>${i18n.t('pages.faq.q8Answer')}</p>
                <ul>
                  <li>${i18n.t('pages.faq.q8Collect')}</li>
                  <li>${i18n.t('pages.faq.q8Use')}</li>
                  <li>${i18n.t('pages.faq.q8Share')}</li>
                  <li>${i18n.t('pages.faq.q8Security')}</li>
                  <li>${i18n.t('pages.faq.q8Rights')}</li>
                </ul>
                <p>${i18n.t('pages.faq.q8PrivacyLink')}</p>
              </div>
            </div>
          </div>

          <section class="faq-footer">
            <h2>${i18n.t('pages.faq.stillHaveQuestions')}</h2>
            <p>${i18n.t('pages.faq.contactSupport')}</p>
            <div class="faq-actions">
              <a href="/feedback" data-link class="btn btn-primary">${i18n.t('pages.faq.sendFeedback')}</a>
              <a href="/how-it-works" data-link class="btn btn-outline">${i18n.t('pages.faq.learnHowItWorks')}</a>
            </div>
          </section>
        </div>
      </div>
    `;
  },

  init() {}
};

export default FAQPage;
