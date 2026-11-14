const cron = require('node-cron');
const PlaceArea = require('../models/PlaceArea');
const { importArea } = require('../utils/placeImport');

const HOUR_MS = 60 * 60 * 1000;
const REFRESH_AFTER_MS = 30 * 24 * HOUR_MS;
// Los primeros reintentos, cada hora; despues, uno al dia, para que una zona
// no se quede sin lugares para siempre si Overpass estuvo caido varias horas.
const FAST_RETRIES = 5;
// Pocas por hora: Overpass es un servicio publico y compartido.
const PER_RUN = 5;

// Reintenta las zonas que fallaron (o quedaron a medias si el proceso se
// reinicio) y actualiza una vez al mes las ya importadas.
const refreshPlaceAreas = async () => {
  try {
    const now = Date.now();
    const hourAgo = new Date(now - HOUR_MS);
    const due = await PlaceArea.find({
      $or: [
        { status: 'failed', attempts: { $lt: FAST_RETRIES }, updated_at: { $lt: hourAgo } },
        { status: 'failed', updated_at: { $lt: new Date(now - 24 * HOUR_MS) } },
        { status: 'pending', updated_at: { $lt: hourAgo } },
        { status: 'done', imported_at: { $lt: new Date(now - REFRESH_AFTER_MS) } },
      ],
    }).sort({ updated_at: 1 }).limit(PER_RUN);

    let done = 0;
    for (const area of due) {
      // Una tras otra: utils/overpass.js ya las separa en el tiempo.
      if (await importArea(area) !== null) done += 1;
    }
    return done;
  } catch (error) {
    console.error('[Cron] Error al actualizar lugares de interes:', error.message);
    return 0;
  }
};

const startPlaceImportCron = () => {
  cron.schedule('45 * * * *', refreshPlaceAreas);
  console.info('[Cron] Place import job started (hourly)');
};

module.exports = { startPlaceImportCron, refreshPlaceAreas };
