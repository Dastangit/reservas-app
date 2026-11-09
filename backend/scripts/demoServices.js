// Servicios completos de ejemplo para las semillas de demo y los tests
// (una propiedad sin todo declarado no se puede aprobar ni publicar).
const demoServices = ({ items = {}, ...overrides } = {}) => ({
  energy_backup: { kind: 'inverter_battery', schedule: { mode: 'always' }, powers_ac: false, note: 'Luces, ventiladores y wifi' },
  air_conditioning: { available: true, schedule: { mode: 'hours', from: '20:00', to: '08:00' }, note: '' },
  items: [
    ['wifi', 'included'], ['hot_water', 'included'], ['kitchen', 'unavailable'], ['tv', 'included'],
    ['laundry', 'extra_cost'], ['parking', 'unavailable'], ['breakfast', 'extra_cost'], ['lunch', 'unavailable'],
    ['dinner', 'unavailable'], ['city_guide', 'extra_cost'],
  ].map(([key, status]) => ({ key, status: items[key] || status, note: '' })),
  house_rules: { quiet_hours: { enabled: true, from: '23:00', to: '07:00' }, lights_out: { enabled: false } },
  ...overrides,
});

module.exports = { demoServices };
