const axios = require('axios');
const env = require('../config/env');

const { appId, appSecret, apiUrl } = env.qvapay;

// Confirmado desde el dashboard de QvaPay (API Playground): v2, con
// autenticacion por headers app-id/app-secret, no por parametros en el
// body/query como asumia la v1. Base: https://api.qvapay.com/v2
const client = axios.create({
  baseURL: apiUrl,
  headers: {
    'content-type': 'application/json',
    'app-id': appId,
    'app-secret': appSecret,
  },
});

// Sin credenciales no se llama a QvaPay: antes salia un 500 con el error de axios.
const isConfigured = () => Boolean(appId && appSecret);

// Devuelve los datos publicos de la app -- util para probar que las
// credenciales estan bien configuradas (POST /v2/info, sin parametros).
async function getAppInfo() {
  const response = await client.post('/info', {});
  return response.data;
}

// Crea una factura de pago. El turista es redirigido a la URL devuelta para
// pagar con tarjeta en el checkout hosteado por QvaPay (www.qvapay.com/pay/...).
// Confirmado contra el API Playground real (POST /v2/create_invoice):
// body: { amount, description, remote_id, webhook?, expire_at?, products? }
// respuesta: { app_id, amount, description, remote_id, transaction_uuid, expire_at, url }
async function createInvoice({ amount, description, remote_id, webhook, expire_at }) {
  const response = await client.post('/create_invoice', {
    amount,
    description,
    remote_id,
    ...(webhook ? { webhook } : {}),
    ...(expire_at ? { expire_at } : {}),
  });

  return response.data;
}

// Busca una transaccion por remote_id (nuestro booking._id) dentro de la
// lista paginada de /v2/transactions (POST, con {page, take}). Confirmado
// contra el API Playground que una factura recien creada en estado
// "pending" (sin pagar) NO aparece todavia en esta lista -- "factura" y
// "transaccion" son cosas distintas en el modelo de QvaPay, esta lista
// parece reflejar solo transacciones ya resueltas.
// AVISO: falta confirmar, con un pago de prueba real completado, como se ve
// el campo de estado (status/state) de un item pagado, y si trae remote_id
// o solo transaction_uuid -- ajustar el filtro de abajo cuando se sepa.
// Cuantas paginas de /transactions se revisan como maximo. La lista viene
// ordenada de mas reciente a mas antigua; con volumen, mirar solo la primera
// pagina dejaba pagos sin encontrar.
const MAX_TRANSACTION_PAGES = 5;
const PAGE_SIZE = 50;

// Devuelve un Map remote_id -> transaccion para los ids pedidos, recorriendo
// como mucho MAX_TRANSACTION_PAGES paginas (se detiene antes si ya los encontro).
async function findTransactionsByRemoteIds(remoteIds) {
  const wanted = new Set(remoteIds.map(String));
  const found = new Map();
  for (let page = 1; page <= MAX_TRANSACTION_PAGES && found.size < wanted.size; page += 1) {
    const response = await client.post('/transactions', { page, take: PAGE_SIZE });
    const transactions = response.data?.transactions || [];
    for (const t of transactions) {
      const id = String(t.remote_id);
      if (wanted.has(id) && !found.has(id)) found.set(id, t);
    }
    if (transactions.length < PAGE_SIZE) break;
  }
  return found;
}

async function findTransactionByRemoteId(remoteId) {
  const found = await findTransactionsByRemoteIds([remoteId]);
  return found.get(String(remoteId)) || null;
}

module.exports = { isConfigured, getAppInfo, createInvoice, findTransactionByRemoteId, findTransactionsByRemoteIds };
