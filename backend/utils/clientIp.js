const crypto = require('crypto');
const net = require('net');

// IP real del cliente. Las peticiones de la web pasan por Vercel (rewrite de
// /api a Render), asi que req.ip es la IP de salida de Vercel, distinta en cada
// peticion y compartida entre usuarios. frontend/middleware.js agrega en /api
// x-elysio-proxy con PROXY_SECRET y x-elysio-client-ip con la IP que vio Vercel
// (borra lo que haya mandado el cliente). Solo si el secreto coincide se usa esa
// IP; si falta, se cae a x-forwarded-for, cuyo formato aqui es
// "<cliente segun Vercel>, <salida de Vercel>" (la ultima la agrega Render), y se
// toma la penultima: lo que un cliente escriba queda a la izquierda y no se usa.
// Sin secreto o si no coincide (alguien llamando directo a Render), se usa
// req.ip como siempre.
const PROXY_HEADER = 'x-elysio-proxy';
const CLIENT_IP_HEADER = 'x-elysio-client-ip';

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
    const fromEdge = String(req.headers[CLIENT_IP_HEADER] || '').trim();
    if (net.isIP(fromEdge)) return fromEdge;
    const hops = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (hops.length >= 2) return hops[hops.length - 2];
  }
  return req.ip || '';
}

module.exports = { clientIp, fromTrustedProxy, PROXY_HEADER, CLIENT_IP_HEADER };
