import i18n from '../i18n.js';

// Texto de una etiqueta de estado. `prefix` es el grupo de claves en los
// locales (el genero cambia: "Aprobada" una reserva, "Aprobado" un anfitrion):
//   bookingCard.status  reservas de alojamiento y de excursiones
//   statusLabel.property  propiedades
//   statusLabel.approval  estado de anfitriones y organizadores
//   statusLabel.account  cuentas de usuario
// Sin traduccion, el valor legible ("pending approval") en lugar de la clave.
export function statusLabel(prefix, status) {
  const key = `${prefix}.${status}`;
  const label = i18n.t(key);
  return label === key ? String(status || '').replace(/_/g, ' ') : label;
}
