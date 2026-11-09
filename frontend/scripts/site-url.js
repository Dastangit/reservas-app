#!/usr/bin/env node
/**
 * site-url.js
 *
 * La direccion publica de la web (canonicals, sitemap, schema, llms.txt...)
 * esta escrita en varios archivos estaticos que no pueden leer variables de
 * entorno. SITE en middleware.js es la referencia; este script revisa que
 * los demas coincidan y, si se le pasa una URL, la cambia en todos.
 *
 * Uso:
 *   node scripts/site-url.js                                # muestra la actual y revisa que coincida
 *   node scripts/site-url.js https://www.elysioexperiences.com  # la cambia en todos los archivos
 *
 * Exit code 0 si coincide (o se cambio), 1 si no (util para CI).
 * El backend (FRONTEND_URL y CORS en backend/app.js) se cambia aparte.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIDDLEWARE = 'middleware.js';
const SITE_RE = /^const SITE = '([^']*)';/m;
const SEO_RE = /^const SITE_URL = '([^']*)';/m;
// Archivos que deben contener la direccion actual (ademas de middleware.js).
const FILES = [
  'app.html',
  'js/utils/seo.js',
  'robots.txt',
  'llms.txt',
  '.well-known/api-catalog',
];

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function currentSite() {
  const m = read(MIDDLEWARE).match(SITE_RE);
  if (!m) fail("middleware.js: no se encontro la linea const SITE = '<origen>';");
  return m[1];
}

function check(site) {
  const errores = [];
  const seo = read('js/utils/seo.js').match(SEO_RE);
  if (!seo) errores.push("js/utils/seo.js: no se encontro la linea const SITE_URL = '<origen>';");
  else if (seo[1] !== site) errores.push(`js/utils/seo.js: SITE_URL es ${seo[1]}`);
  for (const file of FILES) {
    if (!read(file).includes(site)) errores.push(`${file}: no contiene ${site}`);
  }
  return errores;
}

const nueva = process.argv[2];
const actual = currentSite();

if (!nueva) {
  console.log(`middleware.js SITE: ${actual}`);
  const errores = check(actual);
  if (errores.length) {
    errores.forEach((e) => console.error(`  ${e}`));
    fail('la direccion de la web no coincide. Igualala con: node scripts/site-url.js <url>');
  }
  console.log(`OK: la direccion de la web coincide en middleware.js y ${FILES.length} archivos`);
  process.exit(0);
}

let url;
try {
  url = new URL(nueva);
} catch {
  fail(`no es una URL: ${nueva}`);
}
if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
  fail('usa solo el origen https, sin ruta. Ejemplo: https://www.elysioexperiences.com');
}
const origen = url.origin;

// Reemplazo de texto: respeta el formato y los finales de linea de cada archivo.
for (const file of [MIDDLEWARE, ...FILES]) {
  fs.writeFileSync(path.join(ROOT, file), read(file).split(actual).join(origen));
}

const errores = currentSite() === origen ? check(origen) : ['middleware.js: SITE no cambio'];
if (errores.length) {
  errores.forEach((e) => console.error(`  ${e}`));
  fail('no se pudo cambiar en todos los archivos');
}
console.log(`OK: web -> ${origen}. Regenera las paginas (node scripts/prerender.mjs), despliega el frontend y actualiza FRONTEND_URL del backend.`);
