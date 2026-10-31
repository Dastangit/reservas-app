#!/usr/bin/env node
/**
 * api-base.js
 *
 * La direccion del backend esta escrita en dos sitios que no pueden leer
 * variables de entorno: los rewrites de vercel.json (/health y /api/*) y
 * API_BASE en middleware.js. Este script los mantiene iguales.
 *
 * Uso:
 *   node scripts/api-base.js                                    # muestra la actual y revisa que coincidan
 *   node scripts/api-base.js https://api.elysioexperiences.com  # la cambia en los dos archivos
 *
 * Exit code 0 si coinciden (o se cambiaron), 1 si no (util para CI).
 */
const fs = require('fs');
const path = require('path');

const VERCEL = path.join(__dirname, '..', 'vercel.json');
const MIDDLEWARE = path.join(__dirname, '..', 'middleware.js');
const API_BASE_RE = /^const API_BASE = '([^']*)\/api';/m;

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function readOrigins() {
  const vercel = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
  const dest = (source, suffix) => {
    const rule = (vercel.rewrites || []).find((r) => r.source === source);
    if (!rule || !rule.destination.endsWith(suffix)) {
      fail(`vercel.json: falta el rewrite ${source} -> <backend>${suffix}`);
    }
    return rule.destination.slice(0, -suffix.length);
  };
  const m = fs.readFileSync(MIDDLEWARE, 'utf8').match(API_BASE_RE);
  if (!m) fail("middleware.js: no se encontro la linea const API_BASE = '<backend>/api';");
  return {
    'vercel.json /health': dest('/health', '/health'),
    'vercel.json /api/*': dest('/api/:path*', '/api/:path*'),
    'middleware.js API_BASE': m[1],
  };
}

const nueva = process.argv[2];
const actuales = readOrigins();
const distintas = [...new Set(Object.values(actuales))];

if (!nueva) {
  for (const [donde, origen] of Object.entries(actuales)) console.log(`${donde}: ${origen}`);
  if (distintas.length > 1) fail('la direccion del backend no coincide. Igualala con: node scripts/api-base.js <url>');
  console.log('OK: la direccion del backend coincide en vercel.json y middleware.js');
  process.exit(0);
}

let url;
try {
  url = new URL(nueva);
} catch {
  fail(`no es una URL: ${nueva}`);
}
if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
  fail('usa solo el origen https, sin ruta. Ejemplo: https://api.elysioexperiences.com');
}
const origen = url.origin;

// Reemplazo de texto (no JSON.stringify): respeta el formato y los finales de linea de cada archivo.
let vercelTxt = fs.readFileSync(VERCEL, 'utf8');
for (const viejo of distintas) {
  vercelTxt = vercelTxt.split(`"destination": "${viejo}/health"`).join(`"destination": "${origen}/health"`);
  vercelTxt = vercelTxt.split(`"destination": "${viejo}/api/:path*"`).join(`"destination": "${origen}/api/:path*"`);
}
fs.writeFileSync(VERCEL, vercelTxt);
const mwTxt = fs.readFileSync(MIDDLEWARE, 'utf8').replace(API_BASE_RE, `const API_BASE = '${origen}/api';`);
fs.writeFileSync(MIDDLEWARE, mwTxt);

if ([...new Set(Object.values(readOrigins()))].join() !== origen) fail('no se pudo cambiar en los dos archivos');
console.log(`OK: backend -> ${origen} (vercel.json y middleware.js). Despliega el frontend en Vercel.`);
