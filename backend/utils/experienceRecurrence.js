const Experience = require('../models/Experience');

// Genera las instancias de Experience faltantes para una plantilla
// ExperienceRecurrence, dentro de su ventana generate_horizon_days.
// Idempotente: no duplica si la ocurrencia para esa fecha/hora ya existe
// (se apoya en el índice único {recurrence_id, date} del modelo Experience).
// La usa tanto organizerController.createRecurrence (para generar el primer
// lote al crear la serie) como jobs/experienceRecurrenceCron.js (diario).
async function generateOccurrences(recurrence) {
  if (recurrence.status !== 'active') return 0;

  const now = new Date();
  const horizonEnd = new Date(now.getTime() + recurrence.generate_horizon_days * 24 * 60 * 60 * 1000);

  const templateStart = new Date(recurrence.recurrence.start_date);
  const rangeStart = templateStart > now ? templateStart : now;

  const rangeEnd = (recurrence.recurrence.end_date && new Date(recurrence.recurrence.end_date) < horizonEnd)
    ? new Date(recurrence.recurrence.end_date)
    : horizonEnd;

  if (rangeStart > rangeEnd) return 0;

  const daysOfWeek = recurrence.recurrence.days_of_week || [];
  const [hours, minutes] = (recurrence.recurrence.time_of_day || '09:00').split(':').map(Number);

  let created = 0;
  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= rangeEnd) {
    if (daysOfWeek.includes(cursor.getDay())) {
      const occurrenceDate = new Date(cursor);
      occurrenceDate.setHours(hours || 9, minutes || 0, 0, 0);

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
    cursor.setDate(cursor.getDate() + 1);
  }

  return created;
}

module.exports = { generateOccurrences };
