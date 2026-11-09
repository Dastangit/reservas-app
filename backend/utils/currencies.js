// Monedas de los precios de excursiones: cualquier codigo ISO 4217 vigente
// ("MXN", "COP", "EUR", "CUP"...) mas USDT, que no es ISO pero se usa para
// cobrar en cripto. Antes solo se admitian CUP/USD/USDT y un organizador de
// otro pais no podia cobrar en su moneda.
const EXTRA_CURRENCIES = ['USDT'];

let isoCurrencies;
const isoList = () => {
  isoCurrencies ||= new Set(Intl.supportedValuesOf('currency'));
  return isoCurrencies;
};

function normalizeCurrency(value) {
  const code = String(value || '').trim().toUpperCase();
  return EXTRA_CURRENCIES.includes(code) || isoList().has(code) ? code : '';
}

const isValidCurrency = (value) => Boolean(normalizeCurrency(value));

module.exports = { EXTRA_CURRENCIES, normalizeCurrency, isValidCurrency };
