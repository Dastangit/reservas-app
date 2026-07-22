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

module.exports = {
  calculateNights,
  calculateTotal,
  formatDate,
  formatCurrency,
  generateHoldExpiry,
  isHoldExpired,
};
