const Tenant = require('../models/Tenant');
const env = require('../config/env');

// Cache corta: el tenant se resuelve en casi todas las peticiones.
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

async function findTenantByDomain(domain) {
  const hit = cache.get(domain);
  if (hit && hit.expires > Date.now()) return hit.tenant;
  const tenant = await Tenant.findOne({ domain, status: 'active' }).select('_id').lean();
  cache.set(domain, { tenant, expires: Date.now() + CACHE_TTL_MS });
  return tenant;
}

// Resuelve el tenant de la peticion. Fail-closed: si no hay tenant, se corta
// con 503 en vez de dejar req.tenantId vacio (lo que haria que las consultas
// devuelvan datos de todos los tenants).
const setTenant = async (req, res, next) => {
  try {
    let tenantId = req.user?.tenant_id;

    if (!tenantId) {
      const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
      const host = (forwardedHost || req.hostname || '').toLowerCase();
      const tenant = (host && await findTenantByDomain(host))
        || await findTenantByDomain(env.defaultTenantDomain);
      tenantId = tenant?._id;
    }

    if (!tenantId) {
      return res.status(503).json({ success: false, error: 'Tenant not configured' });
    }

    req.tenantId = tenantId;
    next();
  } catch (error) {
    next(error);
  }
};

const filterByTenant = (req, query) => {
  if (!req.tenantId) {
    throw new Error('filterByTenant called without req.tenantId');
  }
  query.tenant_id = req.tenantId;
  return query;
};

module.exports = { setTenant, filterByTenant };
