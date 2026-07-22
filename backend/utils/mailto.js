// Utilidad para generar links mailto: pre-llenados.
// Mismo principio que whatsapp.js: el admin hace clic, su propio cliente de
// correo (Gmail, Outlook, app del teléfono) abre el mensaje ya redactado.
// Cero envío automático, cero dependencia de un proveedor de email.

const buildMailtoLink = (email, subject, body) => {
  if (!email) return null;
  const params = new URLSearchParams({ subject, body });
  // URLSearchParams codifica los espacios como '+', pero mailto: espera %20.
  const query = params.toString().replace(/\+/g, '%20');
  return `mailto:${email}?${query}`;
};

module.exports = { buildMailtoLink };
