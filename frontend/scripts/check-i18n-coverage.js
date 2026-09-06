#!/usr/bin/env node
/**
 * check-i18n-coverage.js
 *
 * Escanea frontend/js/pages/*.js buscando texto visible (dentro de tags HTML,
 * labels, botones, placeholders, aria-label, alt) que NO este envuelto en
 * i18n.t(...) / t(...).
 *
 * Es un heuristico basado en regex, no un parser real de JS/HTML -- puede dar
 * falsos positivos (numeros, simbolos, nombres de marca, texto dentro de
 * comentarios). Sirve para saber donde MIRAR, no como verdad absoluta.
 *
 * Uso:
 *   node scripts/check-i18n-coverage.js
 *   node scripts/check-i18n-coverage.js pages/search.js   (un solo archivo)
 */
const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'js', 'pages');

// Palabras/patrones que NO cuentan como "texto de UI" (para bajar falsos positivos)
const IGNORE_IF_ONLY = [
  /^\$\{.*\}$/, // pura interpolacion
  /^[\d\s.,:/$%-]+$/, // solo numeros/simbolos
  /^https?:\/\//, // URLs
  /^[A-Z_]+$/, // constantes tipo SNAKE_CASE
  /^(WhatsApp|Email|PayPal|QvaPay)$/, // nombres propios/marca que no se traducen
];

function shouldIgnore(text) {
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  return IGNORE_IF_ONLY.some((re) => re.test(trimmed));
}

function containsTranslationCall(text) {
  return /\$\{[^}]*\bt\(|i18n\.t\(/.test(text);
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const usesI18n = /from ['"]\.\.\/i18n\.js['"]/.test(content);
  const lines = content.split('\n');
  const findings = [];

  const tagTextRe = />([^<>{}\n]*[A-Za-zÀ-ÿ]{2,}[^<>{}\n]*)</g;
  const attrTextRe = /(placeholder|aria-label|alt|title)="([^"$\n]{3,})"/g;

  lines.forEach((line, idx) => {
    if (containsTranslationCall(line) && !/[A-Za-zÀ-ÿ]{3,}/.test(line.replace(/\$\{[^}]*\}/g, ''))) {
      return; // la linea ya esta 100% traducida via interpolacion
    }

    let match;
    tagTextRe.lastIndex = 0;
    while ((match = tagTextRe.exec(line)) !== null) {
      const text = match[1];
      if (!shouldIgnore(text) && !text.includes('${')) {
        findings.push({ line: idx + 1, snippet: text.trim(), type: 'texto' });
      }
    }

    attrTextRe.lastIndex = 0;
    while ((match = attrTextRe.exec(line)) !== null) {
      const [, attr, text] = match;
      if (!shouldIgnore(text)) {
        findings.push({ line: idx + 1, snippet: text.trim(), type: attr });
      }
    }
  });

  return { usesI18n, findings };
}

function main() {
  const targetArg = process.argv[2];
  const files = targetArg
    ? [path.basename(targetArg)]
    : fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.js'));

  let totalFindings = 0;
  let filesWithIssues = 0;

  for (const file of files.sort()) {
    const filePath = path.join(PAGES_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.error(`No existe: ${filePath}`);
      continue;
    }

    const { usesI18n, findings } = scanFile(filePath);
    if (findings.length === 0) continue;

    filesWithIssues += 1;
    totalFindings += findings.length;

    const flag = usesI18n ? '(usa i18n, revisar si es residual)' : '(NO importa i18n.js)';
    console.log(`\n${file} ${flag} -- ${findings.length} posible(s):`);
    findings.slice(0, 15).forEach((f) => {
      console.log(`  L${f.line} [${f.type}]  "${f.snippet}"`);
    });
    if (findings.length > 15) {
      console.log(`  ... y ${findings.length - 15} mas`);
    }
  }

  console.log(`\n----`);
  if (totalFindings === 0) {
    console.log('No se encontraron candidatos. (Recuerda: esto es heuristico, no garantiza cobertura 100%.)');
  } else {
    console.log(`${filesWithIssues} archivo(s) con ${totalFindings} candidato(s) a revisar.`);
  }
}

main();
