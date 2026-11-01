import i18n from '../i18n.js';

// Tipos de alojamiento. Misma lista en backend/models/Property.js.
export const PROPERTY_TYPES = [
  'apartment', 'house', 'villa', 'cabin', 'private_room', 'guest_house', 'casa_particular', 'hostel', 'hotel',
];

export const propertyTypeLabel = (type) => {
  const key = `propertyTypes.${type}`;
  const label = i18n.t(key);
  return label === key ? String(type || '').replace(/_/g, ' ') : label;
};

// <option>s de tipos; `emptyLabel` agrega una primera opcion vacia ("Todos").
export const propertyTypeOptions = (selected = '', emptyLabel = '') => (emptyLabel ? `<option value="">${emptyLabel}</option>` : '')
  + PROPERTY_TYPES.map((type) => `<option value="${type}"${type === selected ? ' selected' : ''}>${propertyTypeLabel(type)}</option>`).join('');
