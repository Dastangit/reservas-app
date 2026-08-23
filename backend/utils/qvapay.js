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
async function findTransactionByRemoteId(remoteId, { page = 1, take = 30 } = {}) {
  const response = await client.post('/transactions', { page, take });
  const transactions = response.data?.transactions || [];
  return transactions.find((t) => String(t.remote_id) === String(remoteId)) || null;
}

module.exports = { getAppInfo, createInvoice, findTransactionByRemoteId };
