import i18n from '../i18n.js';
import { escapeHtml } from './escape.js';

// Paises como codigo ISO 3166-1 alfa-2 ("MX", "ES", "CU"), mas XK (Kosovo).
// Misma lista en backend/utils/countries.js. Los nombres los da el navegador
// en el idioma de la pagina, asi no hay que traducir 250 paises a mano.
export const COUNTRY_CODES = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE
  BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD
  CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM
  DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF
  GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU
  ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN
  KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME
  MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA
  NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM
  PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI
  SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK
  TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI
  VN VU WF WS XK YE YT ZA ZM ZW
`.trim().split(/\s+/);

const regionNames = {};
export const countryName = (code) => {
  if (!code) return '';
  const lang = i18n.currentLang || 'en';
  try {
    regionNames[lang] ||= new Intl.DisplayNames([lang], { type: 'region' });
    return regionNames[lang].of(code) || code;
  } catch {
    return code;
  }
};

// "Cancún, México" (o solo la ciudad si no hay pais).
export const formatPlace = (location) => [location?.city, countryName(location?.country)].filter(Boolean).join(', ');

// <option>s de paises ordenados por nombre en el idioma actual. `emptyLabel`
// agrega una primera opcion vacia ("Elige un pais", "Todos los paises").
export const countryOptions = (selected = '', emptyLabel = '') => {
  const lang = i18n.currentLang || 'en';
  const sorted = COUNTRY_CODES.map((code) => [code, countryName(code)])
    .sort((a, b) => a[1].localeCompare(b[1], lang));
  return (emptyLabel ? `<option value="">${escapeHtml(emptyLabel)}</option>` : '')
    + sorted.map(([code, name]) => `<option value="${code}"${code === selected ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('');
};

// Zona horaria del navegador del organizador: buen valor por defecto.
export const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

// <option>s de zonas IANA ("America/Mexico City"), con la seleccionada incluida
// aunque el navegador no la liste.
export const timeZoneOptions = (selected = browserTimeZone()) => {
  let zones = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  if (selected && !zones.includes(selected)) zones = [selected, ...zones];
  return zones.map((z) => `<option value="${escapeHtml(z)}"${z === selected ? ' selected' : ''}>${escapeHtml(z.replace(/_/g, ' '))}</option>`).join('');
};
