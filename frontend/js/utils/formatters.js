const uiLocale = () => window.i18n?.currentLang || 'en';

// Las fechas de reserva (check-in/out) son fechas de calendario guardadas a
// medianoche UTC. Formatearlas en la zona local las mostraba un dia antes en
// toda America; si el valor es medianoche UTC se formatea en UTC.
export const formatDate = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const isCalendarDate = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return d.toLocaleDateString(uiLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(isCalendarDate ? { timeZone: 'UTC' } : {}),
  });
};

// Fecha de hoy (calendario local del usuario) como YYYY-MM-DD. No usar
// toISOString(): en la tarde/noche de America devuelve el dia siguiente.
export const localDateISO = (date = new Date()) => date.toLocaleDateString('sv-SE');

// Suma dias a un YYYY-MM-DD sin pasar por la zona horaria local.
export const addDaysISO = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// La hora de una excursion es la del lugar donde ocurre (su `timezone`), igual
// para todos los visitantes. Excursiones antiguas sin zona eran de Cuba.
export const EXPERIENCE_TIMEZONE = 'America/Havana';
const zoneOf = (timeZone) => timeZone || EXPERIENCE_TIMEZONE;

export const formatExperienceDate = (date, timeZone) => new Date(date).toLocaleDateString(uiLocale(), {
  timeZone: zoneOf(timeZone), year: 'numeric', month: 'short', day: 'numeric',
});

export const formatExperienceTime = (date, timeZone) => new Date(date).toLocaleTimeString(uiLocale(), {
  timeZone: zoneOf(timeZone), hour: '2-digit', minute: '2-digit',
});

// Valor para <input type="datetime-local"> en la zona de la excursion (YYYY-MM-DDTHH:mm).
export const toExperienceInputValue = (date, timeZone) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('sv-SE', { timeZone: zoneOf(timeZone), hour12: false }).replace(' ', 'T').slice(0, 16);
};

export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat(uiLocale(), {
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

// Rellenos para etiquetas con texto blanco (contraste >= 4.5, igual en claro y oscuro).
export const getStatusColor = (status) => {
  const colors = {
    pending_payment: '#B45309',
    pending_approval: '#B45309',
    approved: '#15803D',
    active: '#15803D',
    rejected: '#DC2626',
    cancelled: '#DC2626',
    completed: '#2563EB',
    inactive: '#64748B',
  };
  return colors[status] || '#64748B';
};

export const truncateText = (text, maxLength = 100) => {
  text = String(text || '');
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// formatCurrency() usa Intl.NumberFormat con style:'currency', que solo
// acepta codigos ISO 4217 -- USDT no es un codigo ISO valido y rompe con
// RangeError. Usado en las paginas de excursiones, donde el pricing es
// multi-moneda (CUP/USD/USDT).
export const formatExperiencePrice = (amount, currency) => {
  if (currency === 'USDT') return `${amount} USDT`;
  if (currency === 'CUP') return `${amount} CUP`;
  return formatCurrency(amount, currency);
};
