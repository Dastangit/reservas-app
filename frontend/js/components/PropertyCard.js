import { formatCurrency, truncateText } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';

const PropertyCard = {
  render(property) {
    const primaryImage = property.images?.find(img => img.is_primary) || property.images?.[0];
    const imageUrl = primaryImage?.url || '/assets/placeholder.svg';

    return `
      <div class="property-card" data-id="${property._id}">
        <div class="property-card-image">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(property.name)}" loading="lazy">
          <span class="property-type">${property.type === 'casa_particular' ? 'Casa Particular' : 'Hostel'}</span>
        </div>
        <div class="property-card-content">
          <h3 class="property-card-title">${escapeHtml(property.name)}</h3>
          <p class="property-card-location">${escapeHtml(property.location?.city || 'Location not specified')}</p>
          <p class="property-card-description">${escapeHtml(truncateText(property.description, 80))}</p>
          <div class="property-card-details">
            <span class="property-guests">Max ${property.max_guests} guests</span>
            <span class="property-rating">${property.rating > 0 ? `&#9733; ${property.rating}` : 'New'}</span>
          </div>
          <div class="property-card-footer">
            <span class="property-price">${formatCurrency(property.price_per_night)}<small>/night</small></span>
            <a href="/property/${property._id}" data-link class="btn btn-primary btn-sm">View Details</a>
          </div>
        </div>
      </div>
    `;
  },

  renderGrid(properties) {
    if (!properties || properties.length === 0) {
      return '<p class="no-results">No properties found</p>';
    }
    return properties.map(p => this.render(p)).join('');
  }
};

export default PropertyCard;
