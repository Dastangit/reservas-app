const Booking = require('../models/Booking');
const { notifyAdmins } = require('./pushNotifications');
const { normalizeServices, offerChanges, removedAmenities } = require('./propertyServices');

// Reservas que todavia no terminaron y pueden verse afectadas por un cambio.
const AFFECTED_STATUSES = ['pending_payment', 'pending_approval', 'approved'];

// Si el anfitrion (o el admin) cambia lo que ofrece una propiedad y no es una
// mejora clara, se marca cada reserva futura (el turista lo ve en su reserva y
// puede presentar un reclamo) y se avisa al admin. `before` es la propiedad
// antes del cambio (toObject) y `updates` lo que se guarda. Devuelve cuantas
// reservas se marcaron.
async function flagOfferChanges(tenantId, before, updates) {
  const changes = [];
  if (updates.services !== undefined) {
    const prev = normalizeServices(before.services).value;
    const next = normalizeServices(updates.services).value;
    if (prev && next) changes.push(...offerChanges(prev, next));
  }
  if (updates.amenities !== undefined && removedAmenities(before.amenities, updates.amenities).length) {
    changes.push('amenities');
  }
  if (changes.length === 0) return 0;

  const result = await Booking.updateMany(
    {
      tenant_id: tenantId,
      property_id: before._id,
      status: { $in: AFFECTED_STATUSES },
      check_out: { $gt: new Date() },
    },
    { $set: { offer_changed_at: new Date() }, $addToSet: { offer_changes: { $each: changes } } },
  );

  if (result.modifiedCount > 0) {
    notifyAdmins(tenantId, {
      title: 'Un alojamiento con reservas cambió lo que ofrece',
      body: `"${before.name}" cambió: ${changes.join(', ')}. Afecta a ${result.modifiedCount} reserva(s); los turistas lo ven en su reserva y pueden reclamar.`,
      url: '/admin/properties',
    });
  }
  return result.modifiedCount;
}

module.exports = { flagOfferChanges, AFFECTED_STATUSES };
