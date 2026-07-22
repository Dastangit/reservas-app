const PrivacyPage = {
  render() {
    const lastUpdated = 'July 8, 2026';
    return `
      <div class="legal-page">
        <div class="container">
          <h1>${i18n.t('pages.privacy.title')}</h1>
          <p class="last-updated">${i18n.t('pages.privacy.lastUpdated')}: ${lastUpdated}</p>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s1Title')}</h2>
            <p>${i18n.t('pages.privacy.s1Content')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s2Title')}</h2>
            <p><strong>${i18n.t('pages.privacy.s2Personal')}:</strong></p>
            <ul>
              <li>${i18n.t('pages.privacy.s2Name')}</li>
              <li>${i18n.t('pages.privacy.s2Phone')}</li>
              <li>${i18n.t('pages.privacy.s2Password')}</li>
            </ul>
            <p><strong>${i18n.t('pages.privacy.s2Booking')}:</strong></p>
            <ul>
              <li>${i18n.t('pages.privacy.s2Dates')}</li>
              <li>${i18n.t('pages.privacy.s2Guests')}</li>
              <li>${i18n.t('pages.privacy.s2Payment')}</li>
            </ul>
            <p><strong>${i18n.t('pages.privacy.s2Technical')}:</strong></p>
            <ul>
              <li>${i18n.t('pages.privacy.s2Browser')}</li>
              <li>${i18n.t('pages.privacy.s2Device')}</li>
              <li>${i18n.t('pages.privacy.s2Ip')}</li>
            </ul>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s3Title')}</h2>
            <p>${i18n.t('pages.privacy.s3Content')}</p>
            <ul>
              <li>${i18n.t('pages.privacy.s3Process')}</li>
              <li>${i18n.t('pages.privacy.s3Send')}</li>
              <li>${i18n.t('pages.privacy.s3Communicate')}</li>
              <li>${i18n.t('pages.privacy.s3Improve')}</li>
              <li>${i18n.t('pages.privacy.s3Security')}</li>
              <li>${i18n.t('pages.privacy.s3Comply')}</li>
            </ul>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s4Title')}</h2>
            <p>${i18n.t('pages.privacy.s4Content')}</p>
            <ul>
              <li>${i18n.t('pages.privacy.s4Auth')}</li>
              <li>${i18n.t('pages.privacy.s4Lang')}</li>
            </ul>
            <p>${i18n.t('pages.privacy.s4NoTracking')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s5Title')}</h2>
            <p>${i18n.t('pages.privacy.s5Content')}</p>
            <ul>
              <li>${i18n.t('pages.privacy.s5Hosts')}</li>
              <li>${i18n.t('pages.privacy.s5Payment')}</li>
              <li>${i18n.t('pages.privacy.s5Email')}</li>
              <li>${i18n.t('pages.privacy.s5Database')}</li>
            </ul>
            <p>${i18n.t('pages.privacy.s5NoSell')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s6Title')}</h2>
            <p>${i18n.t('pages.privacy.s6Content')}</p>
            <ul>
              <li>${i18n.t('pages.privacy.s6Bcrypt')}</li>
              <li>${i18n.t('pages.privacy.s6Jwt')}</li>
              <li>${i18n.t('pages.privacy.s6Https')}</li>
              <li>${i18n.t('pages.privacy.s6RateLimit')}</li>
              <li>${i18n.t('pages.privacy.s6Tenant')}</li>
            </ul>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s7Title')}</h2>
            <p>${i18n.t('pages.privacy.s7Content')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s8Title')}</h2>
            <p>${i18n.t('pages.privacy.s8Content')}</p>
            <ul>
              <li>${i18n.t('pages.privacy.s8Access')}</li>
              <li>${i18n.t('pages.privacy.s8Rectification')}</li>
              <li>${i18n.t('pages.privacy.s8Deletion')}</li>
              <li>${i18n.t('pages.privacy.s8Portability')}</li>
              <li>${i18n.t('pages.privacy.s8Objection')}</li>
            </ul>
            <p>${i18n.t('pages.privacy.s8Contact')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s9Title')}</h2>
            <p>${i18n.t('pages.privacy.s9Content')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s10Title')}</h2>
            <p>${i18n.t('pages.privacy.s10Content')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.privacy.s11Title')}</h2>
            <p>${i18n.t('pages.privacy.s11Content')}</p>
            <ul>
              <li>${i18n.t('pages.privacy.s11Email')}</li>
            </ul>
          </section>
        </div>
      </div>
    `;
  },

  init() {}
};

export default PrivacyPage;
