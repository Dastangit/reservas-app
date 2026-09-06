import api from '../api.js';
import i18n from '../i18n.js';
import { formatExperiencePrice } from '../utils/formatters.js';
import auth from '../auth.js';

const ExperienceDetailPage = {
  experience: null,
  spotsAvailable: 0,

  async render() {
    const t = (key) => i18n.t(key);
    const id = this._params?.id || window.location.pathname.split('/').pop();

    try {
      const response = await api.get(`/experiences/${id}`);
      this.experience = response.data?.experience;
      this.spotsAvailable = response.data?.spots_available ?? 0;
    } catch (error) {
      return `<div class="container"><p class="error">${t('experience.notFound')}</p></div>`;
    }

    if (!this.experience) {
      return `<div class="container"><p class="error">${t('experience.notFound')}</p></div>`;
    }

    const exp = this.experience;

    const pricingRows = (exp.pricing || []).map((p) => `
      <div class="info-row">
        <span>${p.audience === 'local' ? t('experience.local') : t('experience.tourist')}</span>
        <span>${formatExperiencePrice(p.amount, p.currency)}</span>
      </div>
    `).join('');

    return `
      <div class="property-detail experience-detail-page">
        <div class="container">
          <div class="property-gallery">
            ${exp.images?.length ? exp.images.map((img, i) => `
              <img src="${img.url}" alt="${img.title || exp.title}" class="${i === 0 ? 'main' : 'thumb'}">
            `).join('') : `<img src="https://via.placeholder.com/800x600?text=${encodeURIComponent(t('experience.noImage'))}" alt="${exp.title}">`}
          </div>

          <div class="property-info">
            <div class="property-main">
              <h1>${exp.title}</h1>
              <p class="property-location">${exp.location?.city || ''}${exp.location?.address ? `, ${exp.location.address}` : ''}</p>

              <div class="property-meta">
                <span>${new Date(exp.date).toLocaleDateString(i18n.currentLang)} ${new Date(exp.date).toLocaleTimeString(i18n.currentLang, { hour: '2-digit', minute: '2-digit' })}</span>
                ${exp.duration_hours ? `<span>${exp.duration_hours}${t('experience.hoursDurationSuffix')}</span>` : ''}
                <span>${this.spotsAvailable} ${t('experience.spotsAvailable')}</span>
                ${exp.allows_mixed_audience ? `<span>${t('experience.mixedGroupsBadge')}</span>` : ''}
              </div>

              <div class="property-description">
                <h2>${t('property.description')}</h2>
                <p>${exp.description}</p>
              </div>

              ${exp.includes?.length ? `
                <div class="property-amenities">
                  <h2>${t('experience.includesHeading')}</h2>
                  <div class="amenities-grid">
                    ${exp.includes.map((i) => `<span class="amenity">${i}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              ${exp.requirements?.length ? `
                <div class="property-amenities">
                  <h2>${t('experience.requirementsHeading')}</h2>
                  <div class="amenities-grid">
                    ${exp.requirements.map((r) => `<span class="amenity">${r}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              ${exp.cancellation_policy ? `
                <div class="property-description">
                  <h2>${t('experience.cancellationPolicyHeading')}</h2>
                  <p>${exp.cancellation_policy}</p>
                </div>
              ` : ''}
            </div>

            <div class="property-sidebar">
              <div class="booking-card">
                <h3 style="margin-bottom:10px;">${t('experience.pricesHeading')}</h3>
                <div class="booking-info">
                  ${pricingRows || `<p>${t('experience.inquirePriceWithOrganizer')}</p>`}
                </div>

                ${this.spotsAvailable > 0 ? `
                  <a href="/experiences/${exp._id}/book" data-link class="btn btn-primary btn-block" style="margin-top:15px;">
                    ${auth.isLoggedIn() ? t('experience.reserveSpot') : t('experience.loginToReserve')}
                  </a>
                ` : `
                  <a href="/experiences/${exp._id}/waitlist" data-link class="btn btn-outline btn-block" style="margin-top:15px;">
                    ${auth.isLoggedIn() ? t('experience.joinWaitlist') : t('experience.loginToWaitlist')}
                  </a>
                `}

                <p style="font-size:0.8rem;color:var(--text-light);margin-top:10px;">
                  ${t('experience.feeNotice')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {},
};

export default ExperienceDetailPage;
