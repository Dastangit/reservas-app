const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Property = require('../models/Property');

// Seed minimo para probar el carrusel de destinos del home (GET
// /search/destinations). Sigue el mismo patron que seedProperties.js:
// mismo tenant/host, idempotente por nombre.
const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding destination demo properties');

    const tenant = await Tenant.findOne({ domain: 'daelworldtravelers.com' });
    if (!tenant) {
      console.error('Tenant not found. Run seed.js first.');
      process.exit(1);
    }

    let host = await User.findOne({ email: 'host@daelworldtravelers.com' });
    if (!host) {
      console.error('Host de prueba no encontrado. Corre seedProperties.js primero.');
      process.exit(1);
    }

    const properties = [
      {
        tenant_id: tenant._id,
        host_id: host._id,
        name: 'Casa del Mar - Varadero (demo)',
        type: 'casa_particular',
        description: 'Propiedad de prueba para el carrusel de destinos de la home. Cerca de la playa de Varadero.',
        location: { city: 'Varadero', neighborhood: 'Centro', address: 'Av. 1ra' },
        max_guests: 4,
        bedrooms: 2,
        bathrooms: 1,
        bed_types: ['Queen', 'Single'],
        price_per_night: 40,
        amenities: ['WiFi', 'Air Conditioning', 'Beach Access'],
        images: [
          { url: 'https://images.pexels.com/photos/19228391/pexels-photo-19228391.jpeg', title: 'Varadero', order: 1, is_primary: true },
        ],
        rating: 4.6,
        reviews_count: 5,
        status: 'active',
        approval_date: new Date(),
      },
      {
        tenant_id: tenant._id,
        host_id: host._id,
        name: 'Casa Malecón - Cienfuegos (demo)',
        type: 'casa_particular',
        description: 'Propiedad de prueba para el carrusel de destinos de la home. En el centro historico de Cienfuegos.',
        location: { city: 'Cienfuegos', neighborhood: 'Centro Historico', address: 'Malecon' },
        max_guests: 3,
        bedrooms: 1,
        bathrooms: 1,
        bed_types: ['Double'],
        price_per_night: 35,
        amenities: ['WiFi', 'Air Conditioning'],
        images: [
          { url: 'https://images.pexels.com/photos/12232064/pexels-photo-12232064.jpeg', title: 'Cienfuegos', order: 1, is_primary: true },
        ],
        rating: 4.7,
        reviews_count: 6,
        status: 'active',
        approval_date: new Date(),
      },
      {
        tenant_id: tenant._id,
        host_id: host._id,
        name: 'Casa Colonial - Trinidad (demo)',
        type: 'casa_particular',
        description: 'Propiedad de prueba para el carrusel de destinos de la home. A pasos de la Plaza Mayor de Trinidad.',
        location: { city: 'Trinidad', neighborhood: 'Centro Historico', address: 'Calle Real' },
        max_guests: 4,
        bedrooms: 2,
        bathrooms: 1,
        bed_types: ['Queen', 'Single'],
        price_per_night: 38,
        amenities: ['WiFi', 'Air Conditioning', 'Historic Building'],
        images: [
          { url: 'https://images.pexels.com/photos/16717001/pexels-photo-16717001.jpeg', title: 'Trinidad', order: 1, is_primary: true },
        ],
        rating: 4.8,
        reviews_count: 9,
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

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seed();
