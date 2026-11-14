import api from '../api.js';
import i18n from '../i18n.js';
import { formatExperiencePrice, formatExperienceDate, formatExperienceTime } from '../utils/formatters.js';
import auth from '../auth.js';
import { escapeHtml } from '../utils/escape.js';
import { formatPlace } from '../utils/places.js';
import { isPoint, showPointMap, directionsUrl } from '../utils/map.js';
import { nearPlacesButtonHtml, nearPlacesListHtml, bindNearPlaces } from '../utils/nearPlaces.js';

const ExperienceDetailPage = {
  experience: null,
  spotsAvailable: 0,

  meta() {
    if (!this.experience) return {};
    const exp = this.experience;
    const city = exp.location?.city || '';
    const title = city ? `${exp.title} – ${city}` : exp.title;
    const description = exp.description
      ? (exp.description.length > 157 ? exp.description.slice(0, 157).trim() + '…' : exp.description)
      : undefined;
    return { title, description, schema: this.buildSchema() };
  },

  buildSchema() {
    const exp = this.experience;
    if (!exp) return undefined;
    const offers = (exp.pricing || []).map((pr) => ({
      '@type': 'Offer',
      price: pr.amount,
      priceCurrency: pr.currency,
      availability: 'https://schema.org/InStock',
      url: window.location.href,
    }));
    const remaining = typeof exp.max_participants === 'number'
      ? Math.max((exp.max_participants || 0) - (exp.current_participants || 0), 0)
      : undefined;
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: exp.title,
      description: exp.description,
      startDate: exp.date,
      image: (exp.images || []).map((img) => img.url),
      location: {
        '@type': 'Place',
        name: exp.location?.city,
        address: {
          '@type': 'PostalAddress',
          streetAddress: exp.location?.address,
          addressLocality: exp.location?.city,
          addressCountry: exp.location?.country,
        },
      },
      maximumAttendeeCapacity: exp.max_participants,
      remainingAttendeeCapacity: remaining,
      offers,
    };
  },


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
          <div class="property-gallery${(exp.images?.length || 0) <= 1 ? ' property-gallery--single' : ''}">
            ${exp.images?.length ? exp.images.map((img, i) => `
              <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.title || exp.title)}" class="${i === 0 ? 'main' : 'thumb'}" loading="${i === 0 ? 'eager' : 'lazy'}">
            `).join('') : `<img src="/assets/placeholder.svg" alt="${escapeHtml(exp.title)}">`}
          </div>

          <div class="property-info">
            <div class="property-main">
              <h1>${escapeHtml(exp.title)}</h1>
              <p class="property-location">${escapeHtml(formatPlace(exp.location))}${exp.location?.address ? `, ${escapeHtml(exp.location.address)}` : ''}</p>

              <div class="property-meta">
                <span>${formatExperienceDate(exp.date, exp.timezone)} ${formatExperienceTime(exp.date, exp.timezone)} (${i18n.t('experience.localTime')})</span>
                ${exp.duration_hours ? `<span>${exp.duration_hours}${t('experience.hoursDurationSuffix')}</span>` : ''}
                <span>${escapeHtml(this.spotsAvailable)} ${t('experience.spotsAvailable')}</span>
                ${exp.allows_mixed_audience ? `<span>${t('experience.mixedGroupsBadge')}</span>` : ''}
              </div>

              <div class="property-description">
                <h2>${t('property.description')}</h2>
                <p>${escapeHtml(exp.description)}</p>
              </div>

              ${isPoint(exp.location?.geo) ? `
                <div class="property-area">
                  <h2>${t('experience.meetingPointTitle')}</h2>
                  ${exp.location?.address ? `<p>${escapeHtml(exp.location.address)}</p>` : ''}
                  <div class="area-actions">
                    <button type="button" class="btn btn-outline btn-sm" id="show-meeting-map">${t('experience.showMeetingMap')}</button>
                    ${exp.status === 'active' ? nearPlacesButtonHtml() : ''}
                    <a class="btn btn-outline btn-sm" href="${escapeHtml(directionsUrl(exp.location.geo))}" target="_blank" rel="noopener">${t('bookingCard.directions')}</a>
                  </div>
                  <div class="area-map" id="area-map" hidden role="img" aria-label="${t('experience.meetingMapLabel')}"></div>
                  ${exp.status === 'active' ? nearPlacesListHtml() : ''}
                </div>
              ` : ''}

              ${exp.includes?.length ? `
                <div class="property-amenities">
                  <h2>${t('experience.includesHeading')}</h2>
                  <div class="amenities-grid">
                    ${exp.includes.map((i) => `<span class="amenity">${escapeHtml(i)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              ${exp.requirements?.length ? `
                <div class="property-amenities">
                  <h2>${t('experience.requirementsHeading')}</h2>
                  <div class="amenities-grid">
                    ${exp.requirements.map((r) => `<span class="amenity">${escapeHtml(r)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              ${exp.cancellation_policy ? `
                <div class="property-description">
                  <h2>${t('experience.cancellationPolicyHeading')}</h2>
                  <p>${escapeHtml(exp.cancellation_policy)}</p>
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
                  <a href="/experiences/${exp._id}/book" data-link class="btn btn-cta btn-block" style="margin-top:15px;">
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

  init() {
    if (!isPoint(this.experience?.location?.geo)) return;
    // El mapa solo se descarga si el turista lo pide (ahorra datos en el movil).
    let mapPromise = null;
    const openMap = () => {
      if (!mapPromise) {
        const container = document.getElementById('area-map');
        document.getElementById('show-meeting-map')?.remove();
        container.hidden = false;
        mapPromise = showPointMap(container, this.experience.location.geo);
        mapPromise.catch(() => {
          container.outerHTML = `<p class="error">${i18n.t('locationPicker.mapFailed')}</p>`;
        });
      }
      return mapPromise;
    };
    document.getElementById('show-meeting-map')?.addEventListener('click', () => openMap().catch(() => {}));
    bindNearPlaces({ query: `experience=${encodeURIComponent(this.experience._id)}`, openMap });
  },
};

export default ExperienceDetailPage;
