import i18n from '../i18n.js';
import { escapeHtml } from './escape.js';

// Monedas de los precios de excursiones: cualquier codigo ISO 4217 que conozca
// el navegador, mas USDT (no es ISO). El backend valida lo mismo en
// backend/utils/currencies.js. Los nombres los da Intl en el idioma de la pagina.
const EXTRA_CURRENCIES = ['USDT'];

// Moneda habitual de cada pais (ISO 3166-1 alfa-2 -> ISO 4217), solo para
// sugerirla primero. Donde los precios se fijan en dolares (Panama, Ecuador,
// El Salvador, Zimbabue...) se sugiere USD.
const COUNTRY_CURRENCY = Object.fromEntries(`
  AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR
  AZ:AZN BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:EUR BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB
  BQ:USD BR:BRL BS:BSD BT:BTN BV:NOK BW:BWP BY:BYN BZ:BZD CA:CAD CC:AUD CD:CDF CF:XAF CG:XAF CH:CHF
  CI:XOF CK:NZD CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CW:XCG CX:AUD CY:EUR CZ:CZK DE:EUR
  DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP EH:MAD ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD
  FK:FKP FM:USD FO:DKK FR:EUR GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD
  GN:GNF GP:EUR GQ:XAF GR:EUR GS:GBP GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD HM:AUD HN:HNL HR:EUR HT:HTG
  HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR IO:USD IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD JO:JOD
  JP:JPY KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP
  LC:XCD LI:CHF LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR
  MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MP:USD MQ:EUR MR:MRU MS:XCD MT:EUR MU:MUR MV:MVR
  MW:MWK MX:MXN MY:MYR MZ:MZN NA:NAD NC:XPF NE:XOF NF:AUD NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD
  NU:NZD NZ:NZD OM:OMR PA:USD PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PN:NZD PR:USD PS:ILS
  PT:EUR PW:USD PY:PYG QA:QAR RE:EUR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK
  SG:SGD SH:SHP SI:EUR SJ:NOK SK:EUR SL:SLE SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:XCG
  SY:SYP SZ:SZL TC:USD TD:XAF TF:EUR TG:XOF TH:THB TJ:TJS TK:NZD TL:USD TM:TMT TN:TND TO:TOP TR:TRY
  TT:TTD TV:AUD TW:TWD TZ:TZS UA:UAH UG:UGX UM:USD US:USD UY:UYU UZ:UZS VA:EUR VC:XCD VE:VES VG:USD
  VI:USD VN:VND VU:VUV WF:XPF WS:WST XK:EUR YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:USD
`.trim().split(/\s+/).map((pair) => pair.split(':')));

let isoCurrencies;
const isoList = () => {
  if (!isoCurrencies) {
    try {
      isoCurrencies = Intl.supportedValuesOf('currency');
    } catch {
      isoCurrencies = ['USD', 'EUR'];
    }
  }
  return isoCurrencies;
};

const supported = (code) => EXTRA_CURRENCIES.includes(code) || isoList().includes(code);

// Moneda sugerida para un pais ("MX" -> "MXN"); USD si no se conoce.
export const countryCurrency = (country) => {
  const code = COUNTRY_CURRENCY[String(country || '').toUpperCase()];
  return code && supported(code) ? code : 'USD';
};

const currencyNames = {};
export const currencyName = (code) => {
  if (code === 'USDT') return 'Tether';
  const lang = i18n.currentLang || 'en';
  try {
    currencyNames[lang] ||= new Intl.DisplayNames([lang], { type: 'currency' });
    return currencyNames[lang].of(code) || code;
  } catch {
    return code;
  }
};

// <option>s de monedas: primero las sugeridas (la del pais, USD, EUR, USDT)
// y despues todas por nombre en el idioma actual.
export const currencyOptions = (selected = 'USD', country = '') => {
  const lang = i18n.currentLang || 'en';
  const option = (code) => `<option value="${escapeHtml(code)}"${code === selected ? ' selected' : ''}>${escapeHtml(`${code} — ${currencyName(code)}`)}</option>`;
  const suggested = [...new Set([country ? countryCurrency(country) : '', 'USD', 'EUR', ...EXTRA_CURRENCIES])]
    .filter((code) => code && supported(code));
  const rest = isoList()
    .filter((code) => !suggested.includes(code))
    .sort((a, b) => currencyName(a).localeCompare(currencyName(b), lang));
  if (selected && !suggested.includes(selected) && !rest.includes(selected)) suggested.push(selected);
  return `<optgroup label="${escapeHtml(i18n.t('currency.suggested'))}">${suggested.map(option).join('')}</optgroup>`
    + `<optgroup label="${escapeHtml(i18n.t('currency.all'))}">${rest.map(option).join('')}</optgroup>`;
};
