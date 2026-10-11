const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Tenant = require('../models/Tenant');
const User = require('../models/User');

// La contrasena del admin inicial NUNCA va en el codigo: se pasa por env.
// Uso: SEED_ADMIN_PASSWORD='...' node scripts/seed.js
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

const seed = async () => {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    console.error('Define SEED_ADMIN_PASSWORD (minimo 12 caracteres) antes de correr el seed.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding');

    let tenant = await Tenant.findOne({ domain: 'elysioexperiences.com' });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Elysio Experiences',
        domain: 'elysioexperiences.com',
        admin_email: 'elysio.support@gmail.com',
        settings: {
          languages: ['en', 'es', 'fr'],
          default_language: 'en',
          currency: 'USD',
          pricing: {
            tourist_fee: 10,
            host_fee: 3,
            trial_months: 1,
          },
          branding: {
            primary_color: '#2C5F8D',
            secondary_color: '#F39C12',
          },
        },
      });
      console.log('Tenant created:', tenant._id);
    } else {
      console.log('Tenant already exists:', tenant._id);
    }

    const adminEmail = 'elysio.support@gmail.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        tenant_id: tenant._id,
        email: adminEmail,
        password_hash: ADMIN_PASSWORD,
        name: 'Support Team',
        role: 'admin',
        status: 'active',
        profile: {
          verified: true,
        },
      });
      console.log('Admin created:', admin._id);
    } else {
      console.log('Admin already exists:', admin._id);
    }

    console.log('\n--- Admin Credentials ---');
    console.log('Email:    elysio.support@gmail.com');
    console.log('Password: (la de SEED_ADMIN_PASSWORD)');
    console.log('--------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seed();
