const cron = require('node-cron');
const ExperienceRecurrence = require('../models/ExperienceRecurrence');
const { generateOccurrences } = require('../utils/experienceRecurrence');

// Genera diariamente las ocurrencias faltantes de cada excursión recurrente
// activa, dentro de su ventana generate_horizon_days (30 días por defecto).
// Idempotente -- ver utils/experienceRecurrence.js. Cada ocurrencia generada
// entra con status pending_approval, igual que cualquier excursión nueva:
// el admin aprueba cada ocurrencia individualmente, no la serie completa.
const runRecurrenceGeneration = async () => {
  try {
    const activeRecurrences = await ExperienceRecurrence.find({ status: 'active' });

    let totalCreated = 0;
    for (const recurrence of activeRecurrences) {
      totalCreated += await generateOccurrences(recurrence);
    }

    if (totalCreated > 0) {
      console.log(`[Cron] Generated ${totalCreated} new experience occurrences`);
    }
  } catch (error) {
    console.error('[Cron] Error generating experience occurrences:', error.message);
  }
};

const startExperienceRecurrenceCron = () => {
  cron.schedule('0 5 * * *', runRecurrenceGeneration);
  console.log('[Cron] Experience recurrence job started (daily at 5am)');
};

module.exports = { startExperienceRecurrenceCron, runRecurrenceGeneration };
