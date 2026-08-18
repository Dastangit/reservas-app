const Experience = require('../models/Experience');
const ExperienceWaitlist = require('../models/ExperienceWaitlist');

// Nunca mas de 2h, y nunca mas de la mitad del tiempo que falta para que
// empiece la excursion. Si falta menos de 1h, no se promueve automatico
// (no da tiempo util a notificar-esperar-reclamar).
function computeClaimWindowMs(experienceDate) {
  const ONE_HOUR = 60 * 60 * 1000;
  const msRemaining = new Date(experienceDate) - new Date();
  if (msRemaining < ONE_HOUR) return null;
  return Math.min(2 * ONE_HOUR, Math.floor(msRemaining / 2));
}

// Al liberarse cupos (rechazo, cancelacion, hold vencido, reclamo vencido),
// reserva el cupo atomicamente para el siguiente en la lista de espera y le
// da una ventana de tiempo para reclamarlo via POST /waitlist/:id/claim.
// El incremento de current_participants pasa ACA (no en claimWaitlistSpot)
// para que nadie mas pueda robarse el cupo mientras el candidato decide.
async function promoteNextWaitlistEntry(tenantId, experienceId) {
  const experience = await Experience.findOne({ _id: experienceId, tenant_id: tenantId });
  if (!experience) return null;

  const next = await ExperienceWaitlist.findOne({
    tenant_id: tenantId,
    experience_id: experienceId,
    status: 'waiting',
  }).sort({ position: 1 });

  if (!next) return null;

  const claimWindowMs = computeClaimWindowMs(experience.date);
  if (claimWindowMs === null) return null; // no queda tiempo util antes de la excursion

  const updatedExperience = await Experience.findOneAndUpdate(
    {
      _id: experienceId,
      tenant_id: tenantId,
      $expr: { $lte: [{ $add: ['$current_participants', next.num_spots_requested] }, '$max_participants'] },
    },
    { $inc: { current_participants: next.num_spots_requested } },
    { new: true }
  );

  if (!updatedExperience) return null; // no alcanzan los cupos liberados para este pedido

  next.status = 'notified';
  next.notified_at = new Date();
  next.claim_expires_at = new Date(Date.now() + claimWindowMs);
  await next.save();

  return next;
}

module.exports = { computeClaimWindowMs, promoteNextWaitlistEntry };
