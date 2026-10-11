const calculateNights = (checkIn, checkOut) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const calculateTotal = (nights, pricePerNight) => {
  return nights * pricePerNight;
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

const generateHoldExpiry = (hours = 3) => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
};

const isHoldExpired = (holdExpiresAt) => {
  return new Date() > new Date(holdExpiresAt);
};

// Escapa los caracteres especiales de regex en texto que viene del usuario
// (query params), para usarlo en new RegExp() sin riesgo de ReDoS ni errores.
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  escapeRegex,
  calculateNights,
  calculateTotal,
  formatDate,
  formatCurrency,
  generateHoldExpiry,
  isHoldExpired,
};

// Paginacion segura para query params: enteros, page >= 1, 1 <= limit <= max.
const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(query.limit)) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

module.exports.parsePagination = parsePagination;
