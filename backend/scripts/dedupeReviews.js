// Busca reseñas duplicadas (misma reserva y mismo autor). Si existen, Mongo no
// puede crear el indice unico { booking_id, reviewer_id } del modelo Review.
//
//   npm run reviews:dedupe            -> solo lista (no cambia nada)
//   npm run reviews:dedupe -- --fix   -> conserva la mas antigua, borra el resto,
//                                        recalcula ratings y crea el indice
const mongoose = require('mongoose');
require('dotenv').config();

const Review = require('../models/Review');
const { recomputePropertyRating } = require('../utils/reviews');

const FIX = process.argv.includes('--fix');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const groups = await Review.aggregate([
    { $sort: { created_at: 1 } },
    {
      $group: {
        _id: { booking_id: '$booking_id', reviewer_id: '$reviewer_id' },
        ids: { $push: '$_id' },
        property_id: { $first: '$property_id' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (groups.length === 0) {
    console.log('No hay reseñas duplicadas.');
  } else {
    console.log(`${groups.length} grupo(s) duplicado(s):`);
    groups.forEach((g) => console.log(`  reserva ${g._id.booking_id} autor ${g._id.reviewer_id}: ${g.count} reseñas`));
  }

  if (FIX) {
    const toDelete = groups.flatMap((g) => g.ids.slice(1));
    if (toDelete.length > 0) {
      await Review.deleteMany({ _id: { $in: toDelete } });
      console.log(`Borradas ${toDelete.length} reseña(s) duplicada(s).`);
      const propertyIds = [...new Set(groups.map((g) => String(g.property_id)))];
      for (const id of propertyIds) await recomputePropertyRating(id);
    }
    await Review.syncIndexes();
    console.log('Indices de Review sincronizados.');
  } else if (groups.length > 0) {
    console.log('\nVuelve a correrlo con --fix para limpiarlas.');
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
