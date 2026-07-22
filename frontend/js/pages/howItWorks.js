const HowItWorksPage = {
  render() {
    return `
      <div class="how-it-works-page">
        <div class="container">
          <h1>${i18n.t('pages.howItWorks.title')}</h1>
          <p class="subtitle">${i18n.t('pages.howItWorks.subtitle')}</p>

          <section class="section">
            <h2>${i18n.t('pages.howItWorks.touristsSection')}</h2>
            <div class="steps">
              <div class="step-card">
                <div class="step-number">1</div>
                <h3>${i18n.t('pages.howItWorks.touristStep1Title')}</h3>
                <p>${i18n.t('pages.howItWorks.touristStep1Desc')}</p>
              </div>
              <div class="step-card">
                <div class="step-number">2</div>
                <h3>${i18n.t('pages.howItWorks.touristStep2Title')}</h3>
                <p>${i18n.t('pages.howItWorks.touristStep2Desc')}</p>
              </div>
              <div class="step-card">
                <div class="step-number">3</div>
                <h3>${i18n.t('pages.howItWorks.touristStep3Title')}</h3>
                <p>${i18n.t('pages.howItWorks.touristStep3Desc')}</p>
              </div>
              <div class="step-card">
                <div class="step-number">4</div>
                <h3>${i18n.t('pages.howItWorks.touristStep4Title')}</h3>
                <p>${i18n.t('pages.howItWorks.touristStep4Desc')}</p>
              </div>
            </div>
          </section>

          <section class="section">
            <h2>${i18n.t('pages.howItWorks.hostsSection')}</h2>
            <div class="steps">
              <div class="step-card">
                <div class="step-number">1</div>
                <h3>${i18n.t('pages.howItWorks.hostStep1Title')}</h3>
                <p>${i18n.t('pages.howItWorks.hostStep1Desc')}</p>
              </div>
              <div class="step-card">
                <div class="step-number">2</div>
                <h3>${i18n.t('pages.howItWorks.hostStep2Title')}</h3>
                <p>${i18n.t('pages.howItWorks.hostStep2Desc')}</p>
              </div>
              <div class="step-card">
                <div class="step-number">3</div>
                <h3>${i18n.t('pages.howItWorks.hostStep3Title')}</h3>
                <p>${i18n.t('pages.howItWorks.hostStep3Desc')}</p>
              </div>
              <div class="step-card">
                <div class="step-number">4</div>
                <h3>${i18n.t('pages.howItWorks.hostStep4Title')}</h3>
                <p>${i18n.t('pages.howItWorks.hostStep4Desc')}</p>
              </div>
            </div>
          </section>

          <section class="section">
            <h2>${i18n.t('pages.howItWorks.paymentSection')}</h2>
            <p class="payment-intro">${i18n.t('pages.howItWorks.paymentIntro')}</p>
            <div class="payment-details">
              <div class="detail-card">
                <h3>${i18n.t('pages.howItWorks.bookingFeeTitle')}</h3>
                <p>${i18n.t('pages.howItWorks.bookingFeeDesc')}</p>
                <ul>
                  <li>${i18n.t('pages.howItWorks.bookingFeeSecures')}</li>
                  <li>${i18n.t('pages.howItWorks.bookingFeeNonRefundable')}</li>
                  <li>${i18n.t('pages.howItWorks.bookingFeeCrypto')}</li>
                  <li>${i18n.t('pages.howItWorks.bookingFeeProcessed')}</li>
                </ul>
              </div>
              <div class="detail-card">
                <h3>${i18n.t('pages.howItWorks.remainderTitle')}</h3>
                <p>${i18n.t('pages.howItWorks.remainderDesc')}</p>
                <ul>
                  <li>${i18n.t('pages.howItWorks.remainderFull')}</li>
                  <li>${i18n.t('pages.howItWorks.remainderDaily')}</li>
                </ul>
              </div>
            </div>
          </section>

          <section class="section">
            <h2>${i18n.t('pages.howItWorks.cancellationSection')}</h2>
            <div class="policy-card">
              <p><strong>${i18n.t('pages.howItWorks.cancellationImportant')}:</strong> ${i18n.t('pages.howItWorks.cancellationDesc')}</p>
              <p>${i18n.t('pages.howItWorks.cancellationRejected')}</p>
            </div>
          </section>

          <section class="section">
            <h2>${i18n.t('pages.howItWorks.needHelpSection')}</h2>
            <div class="contact-help">
              <p>${i18n.t('pages.howItWorks.adminTeamAvailable')}</p>
              <div class="contact-cards">
                <div class="contact-card">
                  <h4>${i18n.t('pages.howItWorks.dastanName')}</h4>
                  <p>${i18n.t('pages.howItWorks.dastanEmail')}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
  },

  init() {}
};

export default HowItWorksPage;
