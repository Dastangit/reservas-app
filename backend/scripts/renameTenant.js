const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');
dotenv.config();

// Node's built-in resolver can fail on some Windows/VPN networks even when
// the OS resolver (nslookup) works fine. Force a public DNS for this process.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const Tenant = require('../models/Tenant');
const User = require('../models/User');

const OLD_DOMAIN = 'daelworldtravelers.com';
const NEW_DOMAIN = 'elysioexperiences.com';
const NEW_NAME = 'Elysio Experiences';
const OLD_EMAIL = 'supportdaelworld@gmail.com';
const NEW_EMAIL = 'elysio.support@gmail.com';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    // 1. Ensure no tenant already exists with the new domain (avoid duplicate/collision)
    const collision = await Tenant.findOne({ domain: NEW_DOMAIN });
    if (collision) {
      console.log('A tenant with the new domain already exists:', collision._id);
      console.log('Aborting to avoid creating a duplicate. Review manually.');
      process.exit(1);
    }

    // 2. Update the existing tenant
    const tenant = await Tenant.findOneAndUpdate(
      { domain: OLD_DOMAIN },
      { $set: { domain: NEW_DOMAIN, name: NEW_NAME, admin_email: NEW_EMAIL } },
      { new: true }
    );

    if (!tenant) {
      console.log('No tenant found with domain:', OLD_DOMAIN);
      console.log('Nothing to migrate - check if it was already renamed.');
      process.exit(0);
    }

    console.log('Tenant updated:', tenant._id, '->', tenant.domain, tenant.name);

    // 3. Update the admin user's email if it still matches the old one
    const admin = await User.findOneAndUpdate(
      { email: OLD_EMAIL },
      { $set: { email: NEW_EMAIL } },
      { new: true }
    );

    if (admin) {
      console.log('Admin user email updated:', admin._id, '->', admin.email);
    } else {
      console.log('No admin user found with old email - skipped (may already be updated).');
    }

    console.log('\nMigration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error.message);
    process.exit(1);
  }
};

run();
