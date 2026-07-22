const Tenant = require('../models/Tenant');

const setTenant = async (req, res, next) => {
  try {
    let tenantId = req.user?.tenant_id;

    if (!tenantId) {
      const host = req.hostname;
      const tenant = await Tenant.findOne({ domain: host });

      if (tenant) {
        tenantId = tenant._id;
      } else {
        const defaultTenant = await Tenant.findOne({ domain: 'daelworldtravelers.com' });
        tenantId = defaultTenant?._id;
      }
    }

    req.tenantId = tenantId;
    next();
  } catch (error) {
    next(error);
  }
};

const filterByTenant = (req, query) => {
  if (req.tenantId) {
    query.tenant_id = req.tenantId;
  }
  return query;
};

module.exports = { setTenant, filterByTenant };
