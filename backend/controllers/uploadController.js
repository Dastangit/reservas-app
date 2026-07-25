const multer = require('multer');
const { uploadImageBuffer, deleteImage } = require('../utils/cloudinary');

// Guarda el archivo en memoria (no en disco) -- se sube a Cloudinary directo
// desde el buffer. L\u00edmite de 8MB por imagen, suficiente para fotos de tel\u00e9fono
// sin abrir la puerta a archivos gigantes que agoten memoria del contenedor.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten archivos de imagen'));
    }
    cb(null, true);
  },
});

exports.uploadMiddleware = upload.single('image');

exports.handleImageUpload = async (req, res, _next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se recibi\u00f3 ning\u00fan archivo' });
    }

    const result = await uploadImageBuffer(req.file.buffer);

    res.json({
      success: true,
      data: { url: result.secure_url, public_id: result.public_id },
    });
  } catch (error) {
    // Si Cloudinary bloquea/rechaza por origen geogr\u00e1fico u otra causa,
    // esto cae aqu\u00ed -- el frontend debe mostrar un mensaje claro y el host
    // siempre puede usar la opci\u00f3n de pegar URL como respaldo.
    console.error('[Upload] Error subiendo a Cloudinary:', error.message);
    res.status(502).json({ success: false, error: 'No se pudo subir la imagen. Puedes usar la opci\u00f3n de pegar un link en su lugar.' });
  }
};

exports.handleImageDelete = async (req, res, _next) => {
  try {
    const { public_id } = req.params;

    if (!public_id) {
      return res.status(400).json({ success: false, error: 'public_id is required' });
    }

    await deleteImage(public_id);

    res.json({ success: true, message: 'Image deleted from Cloudinary' });
  } catch (error) {
    console.error('[Upload] Error deleting from Cloudinary:', error.message);
    res.status(502).json({ success: false, error: 'No se pudo eliminar la imagen de Cloudinary.' });
  }
};
