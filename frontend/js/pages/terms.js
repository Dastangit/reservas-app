const TermsPage = {
  render() {
    const lastUpdated = 'July 8, 2026';
    return `
      <div class="legal-page">
        <div class="container">
          <h1>${i18n.t('pages.terms.title')}</h1>
          <p class="last-updated">${i18n.t('pages.terms.lastUpdated')}: ${lastUpdated}</p>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s1Title')}</h2>
            <p>${i18n.t('pages.terms.s1Content')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s2Title')}</h2>
            <p>${i18n.t('pages.terms.s2Content')}</p>
            <ul>
              <li>${i18n.t('pages.terms.s2Age')}</li>
              <li>${i18n.t('pages.terms.s2Parental')}</li>
              <li>${i18n.t('pages.terms.s2Legal')}</li>
              <li>${i18n.t('pages.terms.s2Accurate')}</li>
            </ul>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s3Title')}</h2>
            <p>${i18n.t('pages.terms.s3Content')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s4Title')}</h2>
            <p>${i18n.t('pages.terms.s4Content')}</p>
            <ul>
              <li>${i18n.t('pages.terms.s4Confidentiality')}</li>
              <li>${i18n.t('pages.terms.s4Activities')}</li>
              <li>${i18n.t('pages.terms.s4Notify')}</li>
            </ul>
            <p>${i18n.t('pages.terms.s4Reserve')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s5Title')}</h2>
            <p>${i18n.t('pages.terms.s5Content')}</p>
            <ul>
              <li>${i18n.t('pages.terms.s5Offer')}</li>
              <li>${i18n.t('pages.terms.s5Fee')}</li>
              <li>${i18n.t('pages.terms.s5Approval')}</li>
              <li>${i18n.t('pages.terms.s5Approved')}</li>
              <li>${i18n.t('pages.terms.s5Rejected')}</li>
            </ul>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s6Title')}</h2>
            <p>${i18n.t('pages.terms.s6Intro')}</p>
            <p><strong>${i18n.t('pages.terms.s6BookingFee')}:</strong></p>
            <ul>
              <li>${i18n.t('pages.terms.s6Flat')}</li>
              <li>${i18n.t('pages.terms.s6NonRefundable')}</li>
              <li>${i18n.t('pages.terms.s6Processed')}</li>
              <li>${i18n.t('pages.terms.s6Accepted')}</li>
            </ul>
            <p><strong>${i18n.t('pages.terms.s6Remainder')}:</strong></p>
            <ul>
              <li>${i18n.t('pages.terms.s6RemainderDesc')}</li>
              <li>${i18n.t('pages.terms.s6RemainderMethods')}</li>
            </ul>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s7Title')}</h2>
            <ul>
              <li>${i18n.t('pages.terms.s7Fee')}</li>
              <li>${i18n.t('pages.terms.s7Cancel')}</li>
              <li>${i18n.t('pages.terms.s7AfterApproval')}</li>
              <li>${i18n.t('pages.terms.s7Rejected')}</li>
            </ul>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s8Title')}</h2>
            <p>${i18n.t('pages.terms.s8Content')}</p>
            <ul>
              <li>${i18n.t('pages.terms.s8Accurate')}</li>
              <li>${i18n.t('pages.terms.s8Maintain')}</li>
              <li>${i18n.t('pages.terms.s8Honor')}</li>
              <li>${i18n.t('pages.terms.s8Comply')}</li>
              <li>${i18n.t('pages.terms.s8Respond')}</li>
            </ul>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s9Title')}</h2>
            <p>${i18n.t('pages.terms.s9Content')}</p>
            <ul>
              <li>${i18n.t('pages.terms.s9Illegal')}</li>
              <li>${i18n.t('pages.terms.s9False')}</li>
              <li>${i18n.t('pages.terms.s9Harass')}</li>
              <li>${i18n.t('pages.terms.s9Access')}</li>
              <li>${i18n.t('pages.terms.s9Automated')}</li>
              <li>${i18n.t('pages.terms.s9Circumvent')}</li>
            </ul>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s10Title')}</h2>
            <p>${i18n.t('pages.terms.s10Content')}</p>
            <ul>
              <li>${i18n.t('pages.terms.s10Quality')}</li>
              <li>${i18n.t('pages.terms.s10Accuracy')}</li>
              <li>${i18n.t('pages.terms.s10Conduct')}</li>
              <li>${i18n.t('pages.terms.s10Damages')}</li>
            </ul>
            <p>${i18n.t('pages.terms.s10Total')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s11Title')}</h2>
            <p>${i18n.t('pages.terms.s11Content')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s12Title')}</h2>
            <p>${i18n.t('pages.terms.s12Content')}</p>
          </section>

          <section class="legal-section">
            <h2>${i18n.t('pages.terms.s13Title')}</h2>
            <p>${i18n.t('pages.terms.s13Content')}</p>
            <ul>
              <li>${i18n.t('pages.terms.s13Email')}</li>
            </ul>
          </section>
        </div>
      </div>
    `;
  },

  init() {}
};

export default TermsPage;
