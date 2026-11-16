const crypto = require('crypto');

// Subida de archivos a Cloudflare R2 (API compatible con S3), para la copia de
// los respaldos fuera del servidor. Firma AWS SigV4 escrita a mano para no
// sumar el SDK de AWS por un solo PUT; la prueba la compara con el ejemplo
// oficial de AWS. Configuracion: R2_ENDPOINT (https://<cuenta>.r2.cloudflarestorage.com),
// R2_BUCKET, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY. Sin las cuatro, no se sube nada.
const R2_VARS = ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];

const isR2Configured = () => R2_VARS.every((name) => process.env[name]);

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// RFC 3986, como lo pide SigV4: encodeURIComponent deja sin codificar !'()*.
const encodeSegment = (segment) => encodeURIComponent(segment)
  .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// Devuelve el valor de Authorization. `headers` debe traer host, x-amz-date y
// x-amz-content-sha256 (todas se firman); `path` ya va codificado.
function signV4({ method, path, headers, payloadHash, accessKeyId, secretAccessKey, region = 'auto', service = 's3' }) {
  const amzDate = headers['x-amz-date'];
  const day = amzDate.slice(0, 8);
  const names = Object.keys(headers).map((name) => name.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonical = [
    method,
    path,
    '',
    names.map((name) => `${name}:${lower[name]}\n`).join(''),
    names.join(';'),
    payloadHash,
  ].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  let key = hmac(`AWS4${secretAccessKey}`, day);
  for (const part of [region, service, 'aws4_request']) key = hmac(key, part);
  const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
}

async function putObject(objectKey, body, { contentType = 'application/octet-stream' } = {}) {
  const endpoint = new URL(process.env.R2_ENDPOINT);
  const path = `/${encodeSegment(process.env.R2_BUCKET)}/${objectKey.split('/').map(encodeSegment).join('/')}`;
  const payloadHash = sha256(body);
  const headers = {
    host: endpoint.host,
    'x-amz-date': new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
    'x-amz-content-sha256': payloadHash,
    'content-type': contentType,
  };
  const authorization = signV4({
    method: 'PUT',
    path,
    headers,
    payloadHash,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  });
  // fetch pone host solo (y no deja fijarlo); el valor es el mismo que se firmo.
  const sent = { ...headers, authorization };
  delete sent.host;
  const response = await fetch(`${endpoint.origin}${path}`, {
    method: 'PUT',
    headers: sent,
    body,
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    // El cuerpo es un XML de error de R2 (codigo y mensaje), sin secretos.
    const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`R2 respondio ${response.status} al subir ${objectKey}: ${detail}`);
  }
}

module.exports = { isR2Configured, signV4, putObject, encodeSegment };
