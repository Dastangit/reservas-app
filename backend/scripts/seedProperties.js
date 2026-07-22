const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Property = require('../models/Property');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding properties');

    const tenant = await Tenant.findOne({ domain: 'daelworldtravelers.com' });
    if (!tenant) {
      console.error('Tenant not found. Run seed.js first.');
      process.exit(1);
    }

    let host = await User.findOne({ email: 'host@daelworldtravelers.com' });
    if (!host) {
      host = await User.create({
        tenant_id: tenant._id,
        email: 'host@daelworldtravelers.com',
        password_hash: 'Host123!',
        name: 'Maria Rodriguez',
        role: 'host',
        phone: '+53 5555 1234',
        status: 'active',
        host_status: 'approved',
        host_region: 'cuba',
        host_fee_waived_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        profile: { verified: true },
      });
      console.log('Host user created');
    }

    const properties = [
      {
        tenant_id: tenant._id,
        host_id: host._id,
        name: 'Casa Azul - Vedado',
        type: 'casa_particular',
        description: 'Beautiful colonial house in the heart of Vedado. Steps from the Malecón, restaurants, and cultural centers. Fully air-conditioned with a tropical garden.',
        location: { city: 'La Habana', neighborhood: 'Vedado', address: 'Calle 23 #124' },
        max_guests: 4,
        bedrooms: 2,
        bathrooms: 1,
        bed_types: ['Queen', 'Single'],
        price_per_night: 45,
        amenities: ['WiFi', 'Air Conditioning', 'Kitchen', 'Garden', 'Washing Machine'],
        images: [
          { url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800', title: 'Living Room', order: 1, is_primary: true },
          { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', title: 'Bedroom', order: 2 },
          { url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800', title: 'Garden', order: 3 },
        ],
        rating: 4.8,
        reviews_count: 12,
        status: 'active',
        approval_date: new Date(),
      },
      {
        tenant_id: tenant._id,
        host_id: host._id,
        name: 'Habana Vieja Loft',
        type: 'casa_particular',
        description: 'Charming loft in a restored colonial building in Old Havana. UNESCO World Heritage location. Rooftop terrace with panoramic views.',
        location: { city: 'La Habana', neighborhood: 'Habana Vieja', address: 'Calle Obispo #215' },
        max_guests: 2,
        bedrooms: 1,
        bathrooms: 1,
        bed_types: ['King'],
        price_per_night: 55,
        amenities: ['WiFi', 'Air Conditioning', 'Rooftop Terrace', 'Historic Building'],
        images: [
          { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', title: 'Loft Interior', order: 1, is_primary: true },
          { url: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800', title: 'Bedroom', order: 2 },
          { url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800', title: 'Rooftop View', order: 3 },
        ],
        rating: 4.9,
        reviews_count: 8,
        status: 'active',
        approval_date: new Date(),
      },
      {
        tenant_id: tenant._id,
        host_id: host._id,
        name: 'Hostal Malecón Beach',
        type: 'hostel',
        description: 'Beachfront hostel with stunning ocean views. Shared kitchen, social areas, and private rooms. Perfect for solo travelers and groups.',
        location: { city: 'La Habana', neighborhood: 'Malecón', address: 'Malecón #412' },
        max_guests: 6,
        bedrooms: 3,
        bathrooms: 2,
        bed_types: ['Queen', 'Bunk', 'Bunk'],
        price_per_night: 25,
        amenities: ['WiFi', 'Air Conditioning', 'Kitchen', 'Ocean View', 'Social Area'],
        images: [
          { url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800', title: 'Common Area', order: 1, is_primary: true },
          { url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800', title: 'Room', order: 2 },
          { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', title: 'Beach', order: 3 },
        ],
        rating: 4.5,
        reviews_count: 20,
        status: 'active',
        approval_date: new Date(),
      },
      {
        tenant_id: tenant._id,
        host_id: host._id,
        name: 'Finca Rural Viñales',
        type: 'casa_particular',
        description: 'Rustic countryside house surrounded by tobacco fields and mountains. Authentic Cuban rural experience with home-cooked meals available.',
        location: { city: 'Viñales', neighborhood: 'Valle', address: 'Carretera a Viñales km 5' },
        max_guests: 3,
        bedrooms: 1,
        bathrooms: 1,
        bed_types: ['Double'],
        price_per_night: 30,
        amenities: ['WiFi', 'Breakfast Included', 'Mountain View', 'Farm Experience'],
        images: [
          { url: 'https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=800', title: 'Countryside House', order: 1, is_primary: true },
          { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', title: 'Mountain View', order: 2 },
          { url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800', title: 'Home-cooked Meal', order: 3 },
        ],
        rating: 4.7,
        reviews_count: 15,
        status: 'active',
        approval_date: new Date(),
      },
    ];

    for (const prop of properties) {
      const existing = await Property.findOne({ name: prop.name });
      if (!existing) {
        await Property.create(prop);
        console.log(`Created: ${prop.name}`);
      } else {
        console.log(`Exists: ${prop.name}`);
      }
    }

    console.log('\n--- Credenciales Host ---');
    console.log('Email:    host@daelworldtravelers.com');
    console.log('Password: Host123!');
    console.log('--------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seed();
