const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Tenant = require('../models/Tenant');
const User = require('../models/User');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding');

    let tenant = await Tenant.findOne({ domain: 'daelworldtravelers.com' });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Da-El World Travelers',
        domain: 'daelworldtravelers.com',
        admin_email: 'supportdaelworld@gmail.com',
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

    const adminEmail = 'supportdaelworld@gmail.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        tenant_id: tenant._id,
        email: adminEmail,
        password_hash: 'Admin123!',
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
    console.log('Email:    supportdaelworld@gmail.com');
    console.log('Password: Admin123!');
    console.log('--------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seed();
