// Escapa texto controlado por usuarios antes de insertarlo en plantillas HTML (innerHTML).
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, (c) => MAP[c]);
}

// Devuelve una URL http(s) segura para atributos src/href, o el fallback.
export function safeUrl(url, fallback = '/assets/placeholder.svg') {
  try {
    const u = new URL(url, window.location.origin);
    return u.protocol === 'https:' || u.protocol === 'http:' ? escapeHtml(u.href) : fallback;
  } catch {
    return fallback;
  }
}
