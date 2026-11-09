// Deja los indices de la coleccion de excursiones como los define el modelo:
// borra el viejo { recurrence_id, date } con `sparse` (impedia publicar dos
// excursiones de fecha unica a la misma hora) y crea el parcial que lo sustituye.
//
//   npm run experiences:sync-indexes            -> solo muestra que cambiaria
//   npm run experiences:sync-indexes -- --fix   -> aplica los cambios
const mongoose = require('mongoose');
require('dotenv').config();

const Experience = require('../models/Experience');

const FIX = process.argv.includes('--fix');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const diff = await Experience.diffIndexes();
  console.log(`Indices que sobran: ${diff.toDrop.length ? diff.toDrop.join(', ') : 'ninguno'}`);
  console.log(`Indices que faltan: ${diff.toCreate.length ? diff.toCreate.map((i) => JSON.stringify(i)).join(', ') : 'ninguno'}`);

  if (FIX && (diff.toDrop.length || diff.toCreate.length)) {
    const dropped = await Experience.syncIndexes();
    console.log(`Hecho. Borrados: ${dropped.length ? dropped.join(', ') : 'ninguno'}.`);
  } else if (!FIX) {
    console.log('Nada cambiado. Para aplicarlo: npm run experiences:sync-indexes -- --fix');
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
