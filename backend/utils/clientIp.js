const crypto = require('crypto');

// IP real del cliente. Las peticiones de la web pasan por Vercel (rewrite de
// /api a Render), asi que req.ip es la IP de salida de Vercel, distinta en cada
// peticion y compartida entre usuarios. Vercel agrega la cabecera
// x-elysio-proxy con PROXY_SECRET (frontend/middleware.js, rutas /api); solo
// si coincide se confia en x-forwarded-for, cuyo formato aqui es
// "<cliente segun Vercel>, <salida de Vercel>" (la ultima la agrega Render).
// Se toma la penultima: lo que un cliente escriba en x-forwarded-for queda a la
// izquierda y no se usa. Sin secreto o si no coincide (alguien llamando directo
// a Render), se usa req.ip como siempre.
const PROXY_HEADER = 'x-elysio-proxy';

function fromTrustedProxy(req) {
  const secret = process.env.PROXY_SECRET || '';
  const sent = String(req.headers[PROXY_HEADER] || '');
  if (!secret || !sent) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function clientIp(req) {
  if (fromTrustedProxy(req)) {
    const hops = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (hops.length >= 2) return hops[hops.length - 2];
  }
  return req.ip || '';
}

module.exports = { clientIp, fromTrustedProxy, PROXY_HEADER };
