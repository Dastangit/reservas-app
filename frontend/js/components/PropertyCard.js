import { formatCurrency, truncateText } from '../utils/formatters.js';
import { escapeHtml, safeUrl } from '../utils/escape.js';
import i18n from '../i18n.js';

const PropertyCard = {
  render(property) {
    const t = (key) => i18n.t(key);
    const primaryImage = property.images?.find(img => img.is_primary) || property.images?.[0];
    const imageUrl = safeUrl(primaryImage?.url);

    return `
      <div class="property-card" data-id="${property._id}">
        <div class="property-card-image">
          <img src="${imageUrl}" alt="${escapeHtml(property.name)}" loading="lazy">
          <span class="property-type">${property.type === 'casa_particular' ? t('propertyCard.typeCasa') : t('propertyCard.typeHostel')}</span>
        </div>
        <div class="property-card-content">
          <h3 class="property-card-title">${escapeHtml(property.name)}</h3>
          <p class="property-card-location">${escapeHtml(property.location?.city || t('propertyCard.locationUnknown'))}</p>
          <p class="property-card-description">${escapeHtml(truncateText(property.description, 80))}</p>
          <div class="property-card-details">
            <span class="property-guests">${t('propertyCard.maxGuests').replace('{n}', property.max_guests)}</span>
            <span class="property-rating">${property.rating > 0 ? `&#9733; ${property.rating}` : t('propertyCard.new')}</span>
          </div>
          <div class="property-card-footer">
            <span class="property-price">${formatCurrency(property.price_per_night, property.currency || 'USD')}<small>${t('propertyCard.perNight')}</small></span>
            <a href="/property/${property._id}" data-link class="btn btn-primary btn-sm">${t('propertyCard.viewDetails')}</a>
          </div>
        </div>
      </div>
    `;
  },

  renderGrid(properties) {
    if (!properties || properties.length === 0) {
      return `<p class="no-results">${i18n.t('propertyCard.noResults')}</p>`;
    }
    return properties.map(p => this.render(p)).join('');
  }
};

export default PropertyCard;
