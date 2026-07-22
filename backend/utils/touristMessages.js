// Plantillas de mensajes para que el admin le escriba manualmente al turista
// (por WhatsApp o correo, vía wa.me / mailto:). No hay envío automático:
// esta función solo arma el texto pre-llenado.
//
// Tipos soportados:
//  - payment_received: se confirmó el pago (fee de $7, o total si es full_online)
//  - payment_reminder: recordatorio de pago pendiente, con la red exacta si se conoce
//  - booking_complete: reserva aprobada y pagada en su totalidad (Opción A)

const TEMPLATES = {
  payment_received: {
    es: ({ touristName, propertyName, checkIn, checkOut, bookingType, totalAmount, feeAmount }) => ({
      subject: `Pago recibido - Reserva en ${propertyName}`,
      body: `Hola ${touristName}, confirmamos que recibimos tu pago de $${feeAmount} USD para tu reserva en `
        + `${propertyName} del ${checkIn} al ${checkOut}. `
        + (bookingType === 'pre_booking'
          ? `Recuerda: el resto (${totalAmount} USD) se paga en efectivo directamente en el alojamiento.`
          : `Tu reserva está pagada en su totalidad.`)
        + ` Tu reserva está pendiente de aprobación, te avisaremos apenas sea confirmada.`,
    }),
    en: ({ touristName, propertyName, checkIn, checkOut, bookingType, totalAmount, feeAmount }) => ({
      subject: `Payment received - Booking at ${propertyName}`,
      body: `Hi ${touristName}, we confirm we received your payment of $${feeAmount} USD for your booking at `
        + `${propertyName} from ${checkIn} to ${checkOut}. `
        + (bookingType === 'pre_booking'
          ? `Reminder: the remaining balance (${totalAmount} USD) is paid in cash directly at the accommodation.`
          : `Your booking is fully paid.`)
        + ` Your booking is pending approval, we'll notify you as soon as it's confirmed.`,
    }),
    fr: ({ touristName, propertyName, checkIn, checkOut, bookingType, totalAmount, feeAmount }) => ({
      subject: `Paiement reçu - Réservation à ${propertyName}`,
      body: `Bonjour ${touristName}, nous confirmons avoir reçu votre paiement de $${feeAmount} USD pour votre `
        + `réservation à ${propertyName} du ${checkIn} au ${checkOut}. `
        + (bookingType === 'pre_booking'
          ? `Rappel : le solde restant (${totalAmount} USD) se paie en espèces directement sur place.`
          : `Votre réservation est entièrement payée.`)
        + ` Votre réservation est en attente d'approbation, nous vous informerons dès sa confirmation.`,
    }),
  },

  payment_reminder: {
    es: ({ touristName, propertyName, feeAmount, network }) => ({
      subject: `Recordatorio: pago pendiente - ${propertyName}`,
      body: `Hola ${touristName}, notamos que tu pago de $${feeAmount} USD para la reserva en ${propertyName} `
        + `aún está pendiente. `
        + (network
          ? `Importante: envía el pago usando exclusivamente la red ${network}. `
          : `Importante: verifica que la red (TRC20 o BEP20) que eliges al pagar coincida exactamente con la que `
            + `te muestra la factura de NOWPayments. `)
        + `Enviar por una red distinta a la indicada resulta en pérdida irreversible de los fondos. `
        + `Si tuviste algún problema para completar el pago, respóndenos y te ayudamos.`,
    }),
    en: ({ touristName, propertyName, feeAmount, network }) => ({
      subject: `Reminder: pending payment - ${propertyName}`,
      body: `Hi ${touristName}, we noticed your payment of $${feeAmount} USD for your booking at ${propertyName} `
        + `is still pending. `
        + (network
          ? `Important: please send the payment using only the ${network} network. `
          : `Important: make sure the network (TRC20 or BEP20) you select matches exactly what your NOWPayments `
            + `invoice shows. `)
        + `Sending on the wrong network results in an irreversible loss of funds. `
        + `If you ran into any issue completing the payment, reply here and we'll help.`,
    }),
    fr: ({ touristName, propertyName, feeAmount, network }) => ({
      subject: `Rappel : paiement en attente - ${propertyName}`,
      body: `Bonjour ${touristName}, nous avons remarqué que votre paiement de $${feeAmount} USD pour votre `
        + `réservation à ${propertyName} est toujours en attente. `
        + (network
          ? `Important : envoyez le paiement uniquement via le réseau ${network}. `
          : `Important : vérifiez que le réseau (TRC20 ou BEP20) choisi correspond exactement à celui indiqué sur `
            + `votre facture NOWPayments. `)
        + `Envoyer sur le mauvais réseau entraîne une perte irréversible des fonds. `
        + `Si vous avez rencontré un problème, répondez ici et nous vous aiderons.`,
    }),
  },

  booking_complete: {
    es: ({ touristName, propertyName, address, checkIn, checkOut, hostName, hostPhone }) => ({
      subject: `Reserva confirmada - ${propertyName}`,
      body: `Hola ${touristName}, tu reserva en ${propertyName} quedó confirmada y pagada en su totalidad. `
        + `Fechas: del ${checkIn} al ${checkOut}. Dirección: ${address || 'te la confirmamos en breve'}. `
        + (hostName ? `Tu anfitrión es ${hostName}${hostPhone ? ` (WhatsApp: ${hostPhone})` : ''}. ` : '')
        + `¡Buen viaje!`,
    }),
    en: ({ touristName, propertyName, address, checkIn, checkOut, hostName, hostPhone }) => ({
      subject: `Booking confirmed - ${propertyName}`,
      body: `Hi ${touristName}, your booking at ${propertyName} is confirmed and fully paid. `
        + `Dates: ${checkIn} to ${checkOut}. Address: ${address || 'we will confirm it shortly'}. `
        + (hostName ? `Your host is ${hostName}${hostPhone ? ` (WhatsApp: ${hostPhone})` : ''}. ` : '')
        + `Have a great trip!`,
    }),
    fr: ({ touristName, propertyName, address, checkIn, checkOut, hostName, hostPhone }) => ({
      subject: `Réservation confirmée - ${propertyName}`,
      body: `Bonjour ${touristName}, votre réservation à ${propertyName} est confirmée et entièrement payée. `
        + `Dates : du ${checkIn} au ${checkOut}. Adresse : ${address || 'nous vous la confirmerons bientôt'}. `
        + (hostName ? `Votre hôte est ${hostName}${hostPhone ? ` (WhatsApp : ${hostPhone})` : ''}. ` : '')
        + `Bon voyage !`,
    }),
  },
};

function buildTouristMessage(type, lang, data) {
  const group = TEMPLATES[type];
  if (!group) return null;
  const builder = group[lang] || group.es;
  return builder(data);
}

module.exports = { buildTouristMessage };
