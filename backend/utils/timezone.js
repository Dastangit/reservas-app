// La hora que escribe el organizador ("09:00") es hora local del lugar de la
// excursion (su campo `timezone`), no del servidor (UTC) ni del visitante.
// EXPERIENCE_TIMEZONE solo se usa para excursiones antiguas sin `timezone`
// (todas eran de Cuba).
const EXPERIENCE_TIMEZONE = process.env.EXPERIENCE_TIMEZONE || 'America/Havana';

// Zona IANA valida ("America/Mexico_City", "Europe/Madrid"...).
function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.includes('/')) return timeZone === 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Partes de calendario (y, m, d, h, min) de un instante en una zona horaria.
function zonedParts(date, timeZone = EXPERIENCE_TIMEZONE) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdays[parts.weekday],
  };
}

// Instante UTC que corresponde a una fecha/hora de pared en `timeZone`.
// Itera dos veces para resolver bien los cambios de horario de verano.
function zonedTimeToUtc(year, month, day, hour = 0, minute = 0, timeZone = EXPERIENCE_TIMEZONE) {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 2; i += 1) {
    const p = zonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += target - asUtc;
  }
  return new Date(guess);
}

// Convierte el valor de un <input type="datetime-local"> ("2026-10-20T09:00")
// a un Date, interpretandolo en la zona de las excursiones. Si el string ya
// trae zona (Z o +hh:mm) se respeta tal cual.
function parseLocalDateTime(value, timeZone = EXPERIENCE_TIMEZONE) {
  if (value instanceof Date) return value;
  const str = String(value || '').trim();
  if (!str) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(str)) return new Date(str);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return new Date(NaN);
  return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), timeZone);
}

// Para textos (WhatsApp, avisos): no dependen del huso del servidor.
// Fecha de calendario de una reserva (guardada a medianoche UTC): "31/10/2026".
const formatCalendarDate = (date, lang = 'es') => new Date(date).toLocaleDateString(lang, { timeZone: 'UTC' });

// Fecha y hora de una excursion en la zona de su lugar: "31/10/2026, 21:00".
const formatExperienceDateTime = (date, timeZone, lang = 'es') => new Date(date).toLocaleString(lang, {
  timeZone: timeZone || EXPERIENCE_TIMEZONE, dateStyle: 'short', timeStyle: 'short',
});

module.exports = { EXPERIENCE_TIMEZONE, isValidTimeZone, formatCalendarDate, formatExperienceDateTime, zonedParts, zonedTimeToUtc, parseLocalDateTime };
