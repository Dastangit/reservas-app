// Telefono de contacto de cada cuenta: el admin lo necesita para hablar con
// anfitriones, organizadores y turistas. Formato internacional (E.164, el que
// usa wa.me): + y codigo de pais, sin espacios ni guiones.
const INTL_PHONE = /^\+[1-9]\d{7,14}$/;

const normalizePhone = (value) => String(value ?? '').trim().replace(/[\s\-().]/g, '');

const isValidPhone = (value) => INTL_PHONE.test(normalizePhone(value));

const PHONE_FORMAT_ERROR = 'Phone must include country code, e.g. +5355512345';

module.exports = { INTL_PHONE, normalizePhone, isValidPhone, PHONE_FORMAT_ERROR };
