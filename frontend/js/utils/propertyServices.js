import i18n from '../i18n.js';
import { escapeHtml } from './escape.js';

// Lo que el anfitrion declara que ofrece: energia de respaldo, aire
// acondicionado, servicios y reglas de la casa. Cada campo exige respuesta,
// aunque sea "no tiene" (el backend lo valida igual). Mismas listas en
// backend/utils/propertyServices.js.
export const SERVICE_ITEMS = [
  'wifi', 'hot_water', 'kitchen', 'tv', 'laundry', 'parking', 'breakfast', 'lunch', 'dinner', 'city_guide',
];
export const ITEM_STATUSES = ['included', 'extra_cost', 'unavailable'];
export const ENERGY_KINDS = ['none', 'inverter_battery', 'generator', 'solar', 'other'];

const t = (key) => i18n.t(key);
const checked = (cond) => (cond ? ' checked' : '');
const attr = (value) => escapeHtml(value ?? '');

const radio = (name, value, label, isChecked) => `
  <label class="radio-inline"><input type="radio" name="${name}" value="${value}" required${checked(isChecked)}> ${label}</label>`;

const timeRange = (prefix, from, to) => `
  <div class="form-row services-time-row">
    <div class="form-group">
      <label for="${prefix}-from">${t('services.from')}</label>
      <input type="time" id="${prefix}-from" value="${attr(from)}">
    </div>
    <div class="form-group">
      <label for="${prefix}-to">${t('services.to')}</label>
      <input type="time" id="${prefix}-to" value="${attr(to)}">
    </div>
  </div>`;

// Seccion del formulario de publicar/editar. `s` son los servicios guardados
// (al editar) o nada (al publicar: todo sin responder).
export const servicesFormHtml = (s = {}, { editing = false } = {}) => {
  const energy = s.energy_backup || {};
  const ac = s.air_conditioning || {};
  const rules = s.house_rules || {};
  const items = Object.fromEntries((s.items || []).map((i) => [i.key, i]));

  return `
    <div class="form-section services-form" id="services-form">
      <h2>${t('services.formTitle')}</h2>
      <p class="field-hint">${t('services.formHint')}</p>
      ${editing ? `<p class="services-edit-warning">${t('services.editHint')}</p>` : ''}

      <fieldset class="services-group">
        <legend>${t('services.acQuestion')}</legend>
        <div class="radio-row">
          ${radio('ac-available', 'yes', t('common.yes'), ac.available === true)}
          ${radio('ac-available', 'no', t('common.no'), ac.available === false)}
        </div>
        <div data-services-when="ac-yes">
          <p class="services-subquestion">${t('services.acWhen')}</p>
          <div class="radio-row">
            ${radio('ac-mode', 'always', t('services.acAlways'), ac.schedule?.mode === 'always')}
            ${radio('ac-mode', 'hours', t('services.onlyHours'), ac.schedule?.mode === 'hours')}
          </div>
          <div data-services-when="ac-hours">${timeRange('ac', ac.schedule?.from, ac.schedule?.to)}</div>
          <div class="form-group">
            <label for="ac-note">${t('services.noteOptional')}</label>
            <input type="text" id="ac-note" maxlength="200" value="${attr(ac.note)}" placeholder="${attr(t('services.acNotePlaceholder'))}">
          </div>
        </div>
      </fieldset>

      <fieldset class="services-group">
        <legend>${t('services.energyQuestion')}</legend>
        <select id="energy-kind" required aria-label="${attr(t('services.energyQuestion'))}">
          <option value="">${t('services.choose')}</option>
          ${ENERGY_KINDS.map((k) => `<option value="${k}"${energy.kind === k ? ' selected' : ''}>${t(`services.energy.${k}`)}</option>`).join('')}
        </select>
        <div data-services-when="energy-yes">
          <p class="services-subquestion">${t('services.energyWhen')}</p>
          <div class="radio-row">
            ${radio('energy-mode', 'always', t('services.energyAlways'), energy.schedule?.mode === 'always')}
            ${radio('energy-mode', 'hours', t('services.onlyHours'), energy.schedule?.mode === 'hours')}
          </div>
          <div data-services-when="energy-hours">${timeRange('energy', energy.schedule?.from, energy.schedule?.to)}</div>
          <div data-services-when="energy-ac">
            <p class="services-subquestion">${t('services.energyPowersAc')}</p>
            <div class="radio-row">
              ${radio('energy-ac', 'yes', t('common.yes'), energy.powers_ac === true)}
              ${radio('energy-ac', 'no', t('common.no'), energy.powers_ac === false)}
            </div>
          </div>
          <div class="form-group">
            <label for="energy-note">${t('services.energyNoteLabel')}</label>
            <input type="text" id="energy-note" maxlength="200" value="${attr(energy.note)}" placeholder="${attr(t('services.energyNotePlaceholder'))}">
          </div>
        </div>
      </fieldset>

      <fieldset class="services-group">
        <legend>${t('services.itemsQuestion')}</legend>
        <div class="services-items">
          ${SERVICE_ITEMS.map((key) => `
            <div class="services-item" data-key="${key}">
              <label for="item-${key}">${t(`services.items.${key}`)}</label>
              <select id="item-${key}" required>
                <option value="">${t('services.choose')}</option>
                ${ITEM_STATUSES.map((st) => `<option value="${st}"${items[key]?.status === st ? ' selected' : ''}>${t(`services.status.${st}`)}</option>`).join('')}
              </select>
              <input type="text" id="item-${key}-note" maxlength="200" value="${attr(items[key]?.note)}" placeholder="${attr(t('services.itemNotePlaceholder'))}" aria-label="${attr(`${t(`services.items.${key}`)}: ${t('services.noteOptional')}`)}">
            </div>`).join('')}
        </div>
      </fieldset>

      <fieldset class="services-group">
        <legend>${t('services.rulesTitle')}</legend>
        <p class="services-subquestion">${t('services.quietQuestion')}</p>
        <div class="radio-row">
          ${radio('quiet', 'no', t('services.quietNone'), rules.quiet_hours?.enabled === false)}
          ${radio('quiet', 'yes', t('services.quietYes'), rules.quiet_hours?.enabled === true)}
        </div>
        <div data-services-when="quiet-yes">${timeRange('quiet', rules.quiet_hours?.from, rules.quiet_hours?.to)}</div>

        <p class="services-subquestion">${t('services.lightsQuestion')}</p>
        <div class="radio-row">
          ${radio('lights', 'no', t('services.lightsNone'), rules.lights_out?.enabled === false)}
          ${radio('lights', 'yes', t('services.lightsYes'), rules.lights_out?.enabled === true)}
        </div>
        <div data-services-when="lights-yes">
          <div class="form-group">
            <label for="lights-at">${t('services.lightsAt')}</label>
            <input type="time" id="lights-at" value="${attr(rules.lights_out?.at)}">
          </div>
        </div>
      </fieldset>
    </div>`;
};

const radioValue = (root, name) => root.querySelector(`input[name="${name}"]:checked`)?.value;
const value = (root, id) => root.querySelector(`#${id}`)?.value || '';

// Muestra solo las preguntas que aplican. Lo oculto queda deshabilitado para que
// el navegador no exija campos que no se ven.
export const bindServicesForm = (root = document) => {
  const form = root.querySelector('#services-form');
  if (!form) return;
  const update = () => {
    const kind = value(form, 'energy-kind');
    const acYes = radioValue(form, 'ac-available') === 'yes';
    const show = {
      'ac-yes': acYes,
      'ac-hours': acYes && radioValue(form, 'ac-mode') === 'hours',
      'energy-yes': Boolean(kind) && kind !== 'none',
      'energy-hours': Boolean(kind) && kind !== 'none' && radioValue(form, 'energy-mode') === 'hours',
      'energy-ac': Boolean(kind) && kind !== 'none' && acYes,
      'quiet-yes': radioValue(form, 'quiet') === 'yes',
      'lights-yes': radioValue(form, 'lights') === 'yes',
    };
    form.querySelectorAll('[data-services-when]').forEach((block) => {
      const visible = show[block.dataset.servicesWhen];
      block.hidden = !visible;
      block.querySelectorAll('input, select').forEach((el) => {
        el.disabled = !visible;
        if (el.type === 'time' || el.type === 'radio') el.required = visible;
      });
    });
  };
  form.addEventListener('change', update);
  update();
};

const schedule = (root, mode, prefix) => (mode === 'hours'
  ? { mode, from: value(root, `${prefix}-from`), to: value(root, `${prefix}-to`) }
  : { mode });

// Lee el formulario en la forma que espera la API.
export const readServicesForm = (root = document) => {
  const form = root.querySelector('#services-form');
  const acAvailable = radioValue(form, 'ac-available') === 'yes';
  const kind = value(form, 'energy-kind');
  const quiet = radioValue(form, 'quiet') === 'yes';
  const lights = radioValue(form, 'lights') === 'yes';
  return {
    air_conditioning: {
      available: acAvailable,
      ...(acAvailable ? { schedule: schedule(form, radioValue(form, 'ac-mode'), 'ac') } : {}),
      note: acAvailable ? value(form, 'ac-note') : '',
    },
    energy_backup: {
      kind,
      ...(kind && kind !== 'none' ? {
        schedule: schedule(form, radioValue(form, 'energy-mode'), 'energy'),
        ...(acAvailable ? { powers_ac: radioValue(form, 'energy-ac') === 'yes' } : {}),
        note: value(form, 'energy-note'),
      } : { note: '' }),
    },
    items: SERVICE_ITEMS.map((key) => ({
      key,
      status: value(form, `item-${key}`),
      note: value(form, `item-${key}-note`),
    })),
    house_rules: {
      quiet_hours: quiet ? { enabled: true, from: value(form, 'quiet-from'), to: value(form, 'quiet-to') } : { enabled: false },
      lights_out: lights ? { enabled: true, at: value(form, 'lights-at') } : { enabled: false },
    },
  };
};

const hours = (sched) => i18n.t('services.fromTo').replace('{from}', sched.from).replace('{to}', sched.to);
const withNote = (text, note) => escapeHtml(note ? `${text} (${note})` : text);

// Frases de energia, A/C y reglas, para la ficha y la copia de la reserva.
const offerLines = (s) => {
  const energy = s.energy_backup || {};
  const ac = s.air_conditioning || {};
  const rules = s.house_rules || {};
  const lines = [];

  if (ac.available) {
    lines.push({ ok: true, text: withNote(`${t('services.acYesLine')}: ${ac.schedule?.mode === 'hours' ? hours(ac.schedule) : t('services.acAlways').toLowerCase()}`, ac.note) });
  } else {
    lines.push({ ok: false, text: escapeHtml(t('services.acNoLine')) });
  }

  if (energy.kind && energy.kind !== 'none') {
    const when = energy.schedule?.mode === 'hours' ? hours(energy.schedule) : t('services.energyAlways').toLowerCase();
    lines.push({ ok: true, text: withNote(`${t(`services.energy.${energy.kind}`)}: ${when}`, energy.note) });
    if (ac.available && energy.powers_ac === false) lines.push({ ok: false, text: escapeHtml(t('services.energyNoAcLine')) });
    if (ac.available && energy.powers_ac === true) lines.push({ ok: true, text: escapeHtml(t('services.energyAcLine')) });
  } else {
    lines.push({ ok: false, text: escapeHtml(t('services.energyNoneLine')) });
  }

  const quiet = rules.quiet_hours;
  if (quiet?.enabled) lines.push({ ok: null, text: escapeHtml(`${t('services.quietLine')}: ${hours(quiet)}`) });
  const lights = rules.lights_out;
  if (lights?.enabled) lines.push({ ok: null, text: escapeHtml(`${t('services.lightsLine')}: ${lights.at}`) });
  return lines;
};

const chips = (list, cls) => list.map((i) => `<span class="amenity ${cls}">${withNote(t(`services.items.${i.key}`), i.note)}</span>`).join('');

// Lo que ofrece el alojamiento, separado en lo que hay, lo que se cobra aparte
// y lo que NO hay. `amenities` son los "otros" en texto libre. Devuelve '' si
// la propiedad no tiene nada declarado (anuncios anteriores a este cambio).
export const servicesDetailHtml = (s, amenities = [], { headingTag = 'h3' } = {}) => {
  const others = (amenities || []).filter(Boolean);
  if (!s?.items?.length) {
    return others.length ? `<div class="amenities-grid">${others.map((a) => `<span class="amenity">${escapeHtml(a)}</span>`).join('')}</div>` : '';
  }
  const by = (status) => s.items.filter((i) => i.status === status);
  const included = by('included');
  const extra = by('extra_cost');
  const unavailable = by('unavailable');
  const h = (key) => `<${headingTag}>${t(key)}</${headingTag}>`;

  return `
    <ul class="offer-lines">
      ${offerLines(s).map((l) => `<li class="${l.ok === true ? 'offer-yes' : l.ok === false ? 'offer-no' : 'offer-rule'}">${l.text}</li>`).join('')}
    </ul>
    ${included.length || others.length ? `${h('services.status.included')}<div class="amenities-grid">${chips(included, 'amenity-yes')}${others.map((a) => `<span class="amenity amenity-yes">${escapeHtml(a)}</span>`).join('')}</div>` : ''}
    ${extra.length ? `${h('services.status.extra_cost')}<div class="amenities-grid">${chips(extra, 'amenity-extra')}</div>` : ''}
    ${unavailable.length ? `${h('services.status.unavailable')}<div class="amenities-grid">${chips(unavailable, 'amenity-no')}</div>` : ''}
  `;
};

// Nombres legibles de lo que cambio (Booking.offer_changes: 'items.wifi', 'energy_backup'...).
export const offerChangeLabel = (change) => {
  if (change.startsWith('items.')) return t(`services.items.${change.slice(6)}`);
  return t(`services.changes.${change.replace('house_rules.', '')}`);
};

// Reservas sobre las que el turista puede presentar un reclamo (igual que
// COMPLAINT_STATUSES en backend/controllers/feedbackController.js).
const COMPLAINT_STATUSES = ['pending_approval', 'approved', 'completed', 'cancelled', 'rejected'];
export const canComplain = (booking) => COMPLAINT_STATUSES.includes(booking?.status);
export const complaintUrl = (booking) => `/feedback?category=complaint&booking_id=${encodeURIComponent(booking._id)}`;

// Aviso en la reserva cuando el anfitrion cambio lo que ofrece despues de reservar.
export const offerChangedNoticeHtml = (booking) => {
  if (!booking?.offer_changed_at) return '';
  const changes = (booking.offer_changes || []).map(offerChangeLabel).join(', ');
  // Sin pagar todavia no hay nada que reclamar: puede cancelar sin costo.
  const body = booking.status === 'pending_payment' ? 'services.changedBodyUnpaid' : 'services.changedBody';
  return `
    <div class="offer-changed-notice" role="status">
      <strong>${t('services.changedTitle')}</strong>
      <p>${escapeHtml(t(body).replace('{changes}', changes))}</p>
      ${canComplain(booking) ? `<a href="${complaintUrl(booking)}" data-link class="btn btn-outline btn-sm">${t('services.complainBtn')}</a>` : ''}
    </div>`;
};
