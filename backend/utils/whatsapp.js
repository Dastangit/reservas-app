// Utilidad para generar links wa.me pre-llenados.
// No usa ninguna API de pago (Twilio, etc.) — el envío final lo hace el admin
// manualmente con un clic desde el panel, sin costo mensual.

const buildWhatsAppLink = (phone, message) => {
  if (!phone) return null;
  const cleanPhone = String(phone).replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

module.exports = { buildWhatsAppLink };
