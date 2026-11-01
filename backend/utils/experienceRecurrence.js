const Experience = require('../models/Experience');
const { zonedParts, zonedTimeToUtc, EXPERIENCE_TIMEZONE } = require('./timezone');

// Nunca se generan ocurrencias mas alla de este horizonte, aunque la
// plantilla pida mas (evita crear miles de documentos de golpe).
const MAX_HORIZON_DAYS = 90;

// Genera las instancias de Experience faltantes para una plantilla
// ExperienceRecurrence, dentro de su ventana generate_horizon_days.
// Idempotente: no duplica si la ocurrencia para esa fecha/hora ya existe
// (se apoya en el índice único {recurrence_id, date} del modelo Experience).
// La usa tanto organizerController.createRecurrence (para generar el primer
// lote al crear la serie) como jobs/experienceRecurrenceCron.js (diario).
async function generateOccurrences(recurrence) {
  if (recurrence.status !== 'active') return 0;

  const now = new Date();
  const horizonDays = Math.min(Math.max(Number(recurrence.generate_horizon_days) || 30, 1), MAX_HORIZON_DAYS);
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  // start_date / end_date son fechas de calendario (se guardan a medianoche
  // UTC): se usan sus partes UTC tal cual, sin convertir de zona.
  const dayOf = (date) => {
    const d = new Date(date);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const timeZone = recurrence.timezone || EXPERIENCE_TIMEZONE;
  const today = zonedParts(now, timeZone);
  const horizon = zonedParts(horizonEnd, timeZone);

  const first = Math.max(dayOf(recurrence.recurrence.start_date), Date.UTC(today.year, today.month - 1, today.day));
  let last = Date.UTC(horizon.year, horizon.month - 1, horizon.day);
  if (recurrence.recurrence.end_date) last = Math.min(last, dayOf(recurrence.recurrence.end_date));

  if (first > last) return 0;

  const daysOfWeek = (recurrence.recurrence.days_of_week || []).map(Number);
  const [hoursRaw, minutesRaw] = String(recurrence.recurrence.time_of_day || '09:00').split(':').map(Number);
  const hours = Number.isInteger(hoursRaw) && hoursRaw >= 0 && hoursRaw <= 23 ? hoursRaw : 9;
  const minutes = Number.isInteger(minutesRaw) && minutesRaw >= 0 && minutesRaw <= 59 ? minutesRaw : 0;

  // Se recorre el calendario del lugar de la serie (no el del servidor en UTC):
  // el dia de la semana y la hora "09:00" son los de su zona horaria.
  let created = 0;
  let cursor = first;

  while (cursor <= last) {
    const day = new Date(cursor);
    if (daysOfWeek.includes(day.getUTCDay())) {
      const occurrenceDate = zonedTimeToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hours, minutes, timeZone);

      if (occurrenceDate >= now) {
        const exists = await Experience.findOne({
          recurrence_id: recurrence._id,
          date: occurrenceDate,
        });

        if (!exists) {
          await Experience.create({
            tenant_id: recurrence.tenant_id,
            organizer_id: recurrence.organizer_id,
            recurrence_id: recurrence._id,
            title: recurrence.title,
            description: recurrence.description,
            category: recurrence.category,
            location: recurrence.location,
            timezone: recurrence.timezone,
            date: occurrenceDate,
            duration_hours: recurrence.duration_hours,
            max_participants: recurrence.max_participants,
            pricing: recurrence.pricing,
            allows_mixed_audience: recurrence.allows_mixed_audience,
            images: recurrence.images,
            includes: recurrence.includes,
            requirements: recurrence.requirements,
            cancellation_policy: recurrence.cancellation_policy,
            status: 'pending_approval',
          });
          created += 1;
        }
      }
    }
    cursor += 24 * 60 * 60 * 1000;
  }

  return created;
}

module.exports = { generateOccurrences };
