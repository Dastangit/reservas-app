#!/usr/bin/env node
/**
 * prerender.mjs
 *
 * Genera el HTML de las paginas publicas de texto para que su contenido
 * llegue sin JavaScript (buscadores, IA, previsualizaciones). Ejecuta en Node
 * las mismas render()/meta() de js/pages y la cabecera/pie sin sesion, con los
 * textos de locales/*.json, sobre la carcasa app.html. Al cargar, app.js
 * vuelve a pintar todo igual que ahora.
 *
 * Salida (no editar a mano):
 *   index.html                      portada en ingles (Vercel la sirve en /)
 *   prerendered/<locale>/index.html portada en es/fr (/es, /fr)
 *   prerendered/<locale>/<pagina>/index.html  resto (rewrites de vercel.json)
 *
 * Uso:
 *   node scripts/prerender.mjs          # regenera los archivos
 *   node scripts/prerender.mjs --check  # solo revisa que esten al dia (CI)
 *
 * Regeneralos al cambiar app.html, locales/*.json, esas paginas, Header o Footer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['en', 'es', 'fr'];
// Rutas sin datos de la API ni listas que dependan de la version de Node (Intl).
const PAGES = [
  { path: '/', module: 'landing' },
  { path: '/how-it-works', module: 'howItWorks' },
  { path: '/faq', module: 'faq' },
  { path: '/terms', module: 'terms' },
  { path: '/privacy', module: 'privacy' },
];
const SITE = fs.readFileSync(path.join(ROOT, 'js/utils/seo.js'), 'utf8').match(/^const SITE_URL = '([^']*)';/m)?.[1];
// Igual que seo.set(): titulo de la pagina + nombre del sitio.
const SITE_NAME = 'Elysio Experiences';
const GENERATED = '<!-- Generado por scripts/prerender.mjs desde app.html: no editar a mano. -->';

function fail(msg) {
  process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(1);
}

if (!SITE) fail("js/utils/seo.js: no se encontro la linea const SITE_URL = '<origen>';");

// ---- Navegador minimo: lo justo para importar los modulos sin sesion ----

const noop = () => {};
const storage = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};
globalThis.document = {
  documentElement: { lang: 'en', dataset: {} },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: noop,
};
window.location = { hostname: new URL(SITE).hostname, pathname: '/', search: '', href: SITE };
window.addEventListener = noop;
window.dispatchEvent = noop;
window.matchMedia = () => ({ matches: false, addEventListener: noop });
// Sin red: la portada pinta sus anuncios destacados al cargar, no aqui.
globalThis.fetch = () => Promise.reject(new Error('prerender: sin red'));
console.error = noop; // landing.js registra el fallo de red esperado

const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
await load('js/config.js');
const { default: i18n } = await load('js/i18n.js');
const { default: Header } = await load('js/components/Header.js');
const { default: Footer } = await load('js/components/Footer.js');
const { default: PropertyCard } = await load('js/components/PropertyCard.js');
const { escapeHtml } = await load('js/utils/escape.js');
for (const locale of LOCALES) {
  i18n.translations[locale] = JSON.parse(fs.readFileSync(path.join(ROOT, `locales/${locale}.json`), 'utf8'));
}

// ---- Plantilla ----

const TEMPLATE = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');

// Reemplaza exactamente una coincidencia; si la plantilla cambia de forma, falla en vez de generar mal.
function replaceOnce(html, re, replacement, what) {
  const matches = html.match(new RegExp(re.source, 'g')) || [];
  if (matches.length !== 1) fail(`app.html: se esperaba 1 ${what}, hay ${matches.length}`);
  return html.replace(re, replacement);
}

const setMeta = (html, attr, name, value) => replaceOnce(
  html,
  new RegExp(`(<meta ${attr}="${name}" content=")[^"]*(">)`),
  `$1${escapeHtml(value)}$2`,
  `<meta ${attr}="${name}">`,
);

// JSON dentro de <script>: sin "<" para que ningun texto pueda cerrar la etiqueta.
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

async function renderPage(page, locale) {
  const localized = i18n.localizePath(page.path, locale);
  i18n.currentLang = locale;
  window.location.pathname = localized;

  const { default: Page } = await load(`js/pages/${page.module}.js`);
  let main = await Page.render();
  if (page.module === 'landing') {
    // Los destacados vienen de la API: sin ella quedaria "no hay resultados".
    const empty = PropertyCard.renderGrid([]);
    if (main.split(empty).length !== 2) fail('landing: no se encontro el aviso de destacados vacio');
    main = main.replace(empty, '');
  }
  const meta = Page.meta();
  const title = meta.title ? `${meta.title} | ${SITE_NAME}` : SITE_NAME;
  const url = `${SITE}${localized}`;

  let html = TEMPLATE;
  html = replaceOnce(html, /<!DOCTYPE html>\n<html lang="en">/, `<!DOCTYPE html>\n${GENERATED}\n<html lang="${locale}">`, '<html lang="en">');
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`, '<title>');
  html = setMeta(html, 'name', 'description', meta.description);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', meta.description);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'name', 'twitter:title', title);
  html = setMeta(html, 'name', 'twitter:description', meta.description);

  // Mismo marcado que seo.js (data-hreflang e id="page-schema"), que lo reutiliza o lo quita al navegar.
  const alternates = [...LOCALES, 'x-default'].map((hreflang) =>
    `  <link rel="alternate" hreflang="${hreflang}" href="${SITE}${i18n.localizePath(page.path, hreflang === 'x-default' ? 'en' : hreflang)}" data-hreflang="true">`);
  const head = [`  <link rel="canonical" href="${url}">`, ...alternates];
  if (meta.schema) head.push(`  <script type="application/ld+json" id="page-schema">${jsonLd(meta.schema)}</script>`);
  html = replaceOnce(html, /\n<\/head>/, `\n${head.join('\n')}\n</head>`, '</head>');

  html = replaceOnce(html, /<header id="header"><\/header>/, `<header id="header">${localizeLinks(Header.render(), locale)}</header>`, '<header id="header">');
  html = replaceOnce(html, /<main id="app"><\/main>/, `<main id="app">${localizeLinks(main, locale)}</main>`, '<main id="app">');
  html = replaceOnce(html, /<footer id="footer"><\/footer>/, `<footer id="footer">${localizeLinks(Footer.render(), locale)}</footer>`, '<footer id="footer">');
  return html;
}

// En la app el router pone el prefijo /es o /fr al hacer clic; sin JavaScript
// los enlaces internos ya tienen que llevarlo.
function localizeLinks(html, locale) {
  return html.replace(/href="(\/[^"?]*)([^"]*)" data-link/g, (all, pathname, query) =>
    (i18n.isLocalizablePath(pathname) ? `href="${i18n.localizePath(pathname, locale)}${query}" data-link` : all));
}

function outputFile(page, locale) {
  if (page.path === '/') return locale === 'en' ? 'index.html' : `prerendered/${locale}/index.html`;
  return `prerendered/${locale}${page.path}/index.html`;
}

// ---- Generar o revisar ----

const check = process.argv.includes('--check');
// El pie lleva el año actual: no cuenta como cambio al revisar.
const normalize = (html) => html.replace(/&copy; \d{4} /g, '&copy; YYYY ');
const stale = [];

for (const page of PAGES) {
  for (const locale of LOCALES) {
    const file = outputFile(page, locale);
    const full = path.join(ROOT, file);
    const html = await renderPage(page, locale);
    if (check) {
      const current = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
      if (current === null || normalize(current) !== normalize(html)) stale.push(file);
    } else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, html);
    }
  }
}

const total = PAGES.length * LOCALES.length;
if (check) {
  if (stale.length) {
    stale.forEach((f) => process.stderr.write(`  desactualizado: ${f}\n`));
    fail('las paginas generadas no estan al dia. Regeneralas con: node frontend/scripts/prerender.mjs');
  }
  console.log(`OK: las ${total} paginas generadas estan al dia`);
} else {
  console.log(`OK: ${total} paginas generadas (index.html y prerendered/)`);
}
