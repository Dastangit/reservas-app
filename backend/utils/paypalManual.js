const env = require('../config/env');

// Arma un link de paypal.me con el monto fijo del fee de reserva. La cuenta
// destino es de un tercero fuera de Cuba (ver PAYPAL_MANUAL_USERNAME) -- no
// hay integracion de API, el turista paga afuera de la plataforma y el admin
// confirma a mano despues de revisar el deposito (no hay webhook posible).
// Devuelve null si no esta configurado, para que el caller pueda avisar en
// vez de mandar un link roto.
function buildPaypalManualLink(amount) {
  const { username } = env.paypalManual;
  if (!username) return null;

  const safeAmount = Number(amount).toFixed(2);
  return `https://paypal.me/${username}/${safeAmount}`;
}

module.exports = { buildPaypalManualLink };
