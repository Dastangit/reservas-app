const Property = require('../models/Property');

// Exclusion mutua por propiedad, valida entre varias instancias del backend:
// MongoDB serializa las escrituras sobre un mismo documento, asi que solo una
// peticion a la vez consigue poner booking_lock_until. El bloqueo caduca solo
// (LOCK_MS) por si el proceso muere con el bloqueo tomado.
const LOCK_MS = 10 * 1000;
const RETRIES = 15;
const RETRY_DELAY_MS = 100;

class PropertyBusyError extends Error {
  constructor() {
    super('This property is being booked right now, please try again in a few seconds');
    this.statusCode = 409;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquire(propertyId) {
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const now = new Date();
    const until = new Date(now.getTime() + LOCK_MS);
    const result = await Property.updateOne(
      {
        _id: propertyId,
        $or: [{ booking_lock_until: null }, { booking_lock_until: { $lt: now } }],
      },
      { $set: { booking_lock_until: until } },
    );
    if (result.modifiedCount === 1) return until;
    await sleep(RETRY_DELAY_MS + Math.floor(Math.random() * RETRY_DELAY_MS));
  }
  throw new PropertyBusyError();
}

// Ejecuta fn() con la propiedad bloqueada y siempre libera al terminar
// (solo si el bloqueo sigue siendo el nuestro).
async function withPropertyLock(propertyId, fn) {
  const until = await acquire(propertyId);
  try {
    return await fn();
  } finally {
    await Property.updateOne(
      { _id: propertyId, booking_lock_until: until },
      { $set: { booking_lock_until: null } },
    ).catch(() => {});
  }
}

module.exports = { withPropertyLock, PropertyBusyError, LOCK_MS };
