#!/usr/bin/env node
/**
 * check-i18n-keys.js
 *
 * Compara los 3 archivos de locale (en/es/fr) y reporta:
 *   - claves que existen en un idioma pero faltan en otro
 *   - JSON invalido en cualquiera de los 3 archivos
 *
 * Uso:
 *   node scripts/check-i18n-keys.js
 *
 * Exit code 0 si todo esta sincronizado, 1 si falta algo (util para CI).
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');
const LANGS = ['en', 'es', 'fr'];

function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, fullKey, out);
    } else {
      out[fullKey] = true;
    }
  }
  return out;
}

function loadLocale(lang) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`\u2716 ${lang}.json tiene JSON invalido: ${err.message}`);
    process.exitCode = 1;
    return null;
  }
}

function main() {
  const flatByLang = {};
  let hasParseError = false;

  for (const lang of LANGS) {
    const data = loadLocale(lang);
    if (!data) {
      hasParseError = true;
      continue;
    }
    flatByLang[lang] = flatten(data);
  }

  if (hasParseError) {
    console.error('\nCorrige el JSON invalido antes de seguir.');
    process.exit(1);
  }

  const allKeys = new Set();
  for (const lang of LANGS) {
    Object.keys(flatByLang[lang]).forEach((k) => allKeys.add(k));
  }

  let missingCount = 0;
  const missingByLang = { en: [], es: [], fr: [] };

  for (const key of Array.from(allKeys).sort()) {
    for (const lang of LANGS) {
      if (!flatByLang[lang][key]) {
        missingByLang[lang].push(key);
        missingCount += 1;
      }
    }
  }

  if (missingCount === 0) {
    console.log(`\u2713 Los 3 locales (en/es/fr) estan sincronizados: ${allKeys.size} claves cada uno.`);
    process.exit(0);
  }

  console.log(`\u2716 Encontradas ${missingCount} claves faltantes:\n`);
  for (const lang of LANGS) {
    if (missingByLang[lang].length > 0) {
      console.log(`  Faltan en ${lang}.json (${missingByLang[lang].length}):`);
      missingByLang[lang].forEach((k) => console.log(`    - ${k}`));
      console.log('');
    }
  }

  process.exit(1);
}

main();
