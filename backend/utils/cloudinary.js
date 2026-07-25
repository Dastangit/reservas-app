const cloudinary = require('cloudinary').v2;
const env = require('../config/env');

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

// Sube un buffer de imagen (ya en memoria, viene de multer) directo a
// Cloudinary sin pasar por disco. Devuelve la URL segura (https) final.
function uploadImageBuffer(buffer, folder = 'reservas-app/properties') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { cloudinary, uploadImageBuffer, deleteImage };
