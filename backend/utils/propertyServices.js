// Lo que el anfitrion declara que ofrece su alojamiento: energia de respaldo,
// aire acondicionado, servicios y reglas de la casa. Cada campo exige una
// respuesta, aunque sea "no tiene": el turista debe saber antes de reservar
// que va a encontrar y que no (evita reclamos de "reserve una cosa y me dieron
// otra"). Mismas listas en frontend/js/utils/propertyServices.js.

const SERVICE_ITEMS = [
  'wifi', 'hot_water', 'kitchen', 'tv', 'laundry', 'parking', 'breakfast', 'lunch', 'dinner', 'city_guide',
];
const ITEM_STATUSES = ['included', 'extra_cost', 'unavailable'];
const ENERGY_KINDS = ['none', 'inverter_battery', 'generator', 'solar', 'other'];
// always: siempre (el respaldo, en cada corte; el A/C, cuando el huesped quiera).
// hours: solo entre `from` y `to`.
const SCHEDULE_MODES = ['always', 'hours'];
const NOTE_MAX = 200;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const note = (value) => String(value ?? '').trim().slice(0, NOTE_MAX);
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function normalizeSchedule(input, label) {
  if (!isPlainObject(input) || !SCHEDULE_MODES.includes(input.mode)) {
    return { error: `${label}: choose a schedule (${SCHEDULE_MODES.join(' / ')})` };
  }
  if (input.mode === 'always') return { value: { mode: 'always' } };
  if (!TIME_RE.test(input.from) || !TIME_RE.test(input.to)) {
    return { error: `${label}: schedule needs "from" and "to" as HH:MM` };
  }
  return { value: { mode: 'hours', from: input.from, to: input.to } };
}

// Valida y deja en forma canonica (mismo orden de claves, sin extras) lo que
// manda el formulario. Devuelve { value } o { error } con un mensaje en ingles,
// como el resto de errores de la API.
function normalizeServices(input) {
  if (!isPlainObject(input)) return { error: 'Services are required: answer every item, even if the answer is "no"' };

  const ac = input.air_conditioning;
  if (!isPlainObject(ac) || typeof ac.available !== 'boolean') {
    return { error: 'Air conditioning: answer yes or no' };
  }
  const airConditioning = { available: ac.available };
  if (ac.available) {
    const schedule = normalizeSchedule(ac.schedule, 'Air conditioning');
    if (schedule.error) return schedule;
    airConditioning.schedule = schedule.value;
  }
  airConditioning.note = note(ac.note);

  const energy = input.energy_backup;
  if (!isPlainObject(energy) || !ENERGY_KINDS.includes(energy.kind)) {
    return { error: `Energy backup: choose one (${ENERGY_KINDS.join(' / ')})` };
  }
  const energyBackup = { kind: energy.kind };
  if (energy.kind !== 'none') {
    const schedule = normalizeSchedule(energy.schedule, 'Energy backup');
    if (schedule.error) return schedule;
    energyBackup.schedule = schedule.value;
    // Fuente clasica de reclamos: el respaldo da luz y wifi pero no el A/C.
    if (ac.available) {
      if (typeof energy.powers_ac !== 'boolean') {
        return { error: 'Energy backup: say whether it keeps the air conditioning running' };
      }
      energyBackup.powers_ac = energy.powers_ac;
    }
  }
  energyBackup.note = note(energy.note);

  const rawItems = Array.isArray(input.items) ? input.items : [];
  const byKey = new Map();
  for (const item of rawItems) {
    if (!isPlainObject(item) || !SERVICE_ITEMS.includes(item.key)) {
      return { error: `Unknown service: ${isPlainObject(item) ? item.key : item}` };
    }
    if (byKey.has(item.key)) return { error: `Service answered twice: ${item.key}` };
    if (!ITEM_STATUSES.includes(item.status)) {
      return { error: `Service ${item.key}: choose ${ITEM_STATUSES.join(' / ')}` };
    }
    byKey.set(item.key, { key: item.key, status: item.status, note: note(item.note) });
  }
  const missing = SERVICE_ITEMS.filter((key) => !byKey.has(key));
  if (missing.length) return { error: `Answer every service (missing: ${missing.join(', ')})` };

  const rules = isPlainObject(input.house_rules) ? input.house_rules : null;
  if (!rules || !isPlainObject(rules.quiet_hours) || typeof rules.quiet_hours.enabled !== 'boolean'
    || !isPlainObject(rules.lights_out) || typeof rules.lights_out.enabled !== 'boolean') {
    return { error: 'House rules: answer quiet hours and lights-out time, even if there are none' };
  }
  const quiet = { enabled: rules.quiet_hours.enabled };
  if (quiet.enabled) {
    if (!TIME_RE.test(rules.quiet_hours.from) || !TIME_RE.test(rules.quiet_hours.to)) {
      return { error: 'Quiet hours need "from" and "to" as HH:MM' };
    }
    quiet.from = rules.quiet_hours.from;
    quiet.to = rules.quiet_hours.to;
  }
  const lightsOut = { enabled: rules.lights_out.enabled };
  if (lightsOut.enabled) {
    if (!TIME_RE.test(rules.lights_out.at)) return { error: 'Lights-out time must be HH:MM' };
    lightsOut.at = rules.lights_out.at;
  }

  return {
    value: {
      energy_backup: energyBackup,
      air_conditioning: airConditioning,
      items: SERVICE_ITEMS.map((key) => byKey.get(key)),
      house_rules: { quiet_hours: quiet, lights_out: lightsOut },
    },
  };
}

// true si la propiedad tiene todo declarado (las anteriores a este cambio no).
const hasCompleteServices = (services) => !normalizeServices(services).error;

const ITEM_RANK = { unavailable: 0, extra_cost: 1, included: 2 };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Que partes de la oferta cambiaron sin ser una mejora clara, entre lo que habia
// y lo nuevo (los dos ya normalizados). Una mejora clara: aparece un respaldo,
// aparece el A/C, un servicio sube de nivel o se quita una regla. Todo lo demas
// (quitar, cobrar aparte, recortar horarios o cambiar una nota) se avisa al
// turista con reserva. Devuelve claves como 'energy_backup' o 'items.wifi'.
function offerChanges(before, after) {
  if (!before) return [];
  const changes = [];

  const energyImproved = before.energy_backup.kind === 'none' && after.energy_backup.kind !== 'none';
  if (!energyImproved && !same(before.energy_backup, after.energy_backup)) changes.push('energy_backup');

  const acImproved = !before.air_conditioning.available && after.air_conditioning.available;
  if (!acImproved && !same(before.air_conditioning, after.air_conditioning)) changes.push('air_conditioning');

  for (const key of SERVICE_ITEMS) {
    const b = before.items.find((i) => i.key === key);
    const a = after.items.find((i) => i.key === key);
    if (ITEM_RANK[a.status] > ITEM_RANK[b.status]) continue;
    if (!same(a, b)) changes.push(`items.${key}`);
  }

  for (const rule of ['quiet_hours', 'lights_out']) {
    const b = before.house_rules[rule];
    const a = after.house_rules[rule];
    const removed = b.enabled && !a.enabled;
    if (!removed && !same(a, b)) changes.push(`house_rules.${rule}`);
  }
  return changes;
}

// Servicios "otros" (lista libre) que el anfitrion quito.
const removedAmenities = (before = [], after = []) => {
  const now = new Set(after.map((a) => String(a).trim().toLowerCase()));
  return before.filter((a) => !now.has(String(a).trim().toLowerCase()));
};

module.exports = {
  SERVICE_ITEMS,
  ITEM_STATUSES,
  ENERGY_KINDS,
  SCHEDULE_MODES,
  normalizeServices,
  hasCompleteServices,
  offerChanges,
  removedAmenities,
};
