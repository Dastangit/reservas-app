export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const calculateNights = (checkIn, checkOut) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getStatusColor = (status) => {
  const colors = {
    pending_payment: '#F39C12',
    pending_approval: '#F39C12',
    approved: '#27AE60',
    active: '#27AE60',
    rejected: '#E74C3C',
    cancelled: '#E74C3C',
    completed: '#3498DB',
    inactive: '#95A5A6',
  };
  return colors[status] || '#95A5A6';
};

export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
