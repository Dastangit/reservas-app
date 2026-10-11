const multer = require('multer');
const Property = require('../models/Property');
const Experience = require('../models/Experience');
const { uploadImageBuffer, deleteImage } = require('../utils/cloudinary');

// Formatos permitidos. SVG queda fuera a proposito: puede contener scripts.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Guarda el archivo en memoria (no en disco) -- se sube a Cloudinary directo
// desde el buffer. L\u00edmite de 8MB por imagen, suficiente para fotos de tel\u00e9fono
// sin abrir la puerta a archivos gigantes que agoten memoria del contenedor.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Solo se permiten im\u00e1genes JPG, PNG o WebP'));
    }
    cb(null, true);
  },
});

const uploadSingle = upload.single('image');

// Convierte los errores de multer (tama\u00f1o, formato) en un 400 claro en vez de un 500.
exports.uploadMiddleware = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'La imagen supera el l\u00edmite de 8MB'
      : err.message;
    return res.status(400).json({ success: false, error: message });
  });
};

// El mimetype lo declara el cliente y es falsificable: comprobamos la firma real del archivo.
function hasAllowedImageSignature(buffer) {
  if (!buffer || buffer.length < 12) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return isJpeg || isPng || isWebp;
}

exports.handleImageUpload = async (req, res, _next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se recibi\u00f3 ning\u00fan archivo' });
    }

    if (!hasAllowedImageSignature(req.file.buffer)) {
      return res.status(400).json({ success: false, error: 'El archivo no es una imagen JPG, PNG o WebP v\u00e1lida' });
    }

    // Carpeta por usuario: permite comprobar la propiedad al borrar.
    const result = await uploadImageBuffer(req.file.buffer, `reservas-app/uploads/${req.user._id}`);

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

const PUBLIC_ID_PATTERN = /^reservas-app\/[A-Za-z0-9_\-/]{1,200}$/;

// Una imagen es del usuario si esta en su carpeta, o si su public_id figura en
// una propiedad (host) o experiencia (organizador) suya -- cubre subidas
// anteriores a las carpetas por usuario. Desde utils/images.js un usuario ya no
// puede guardar public_ids ajenos, y la URL ya no se usa como prueba (es un
// campo libre que cualquiera podia copiar de otra propiedad).
async function userOwnsImage(user, publicId) {
  if (publicId.startsWith(`reservas-app/uploads/${user._id}/`)) return true;
  if (publicId.startsWith('reservas-app/uploads/')) return false;

  const [property, experience] = await Promise.all([
    Property.exists({ host_id: user._id, 'images.public_id': publicId }),
    Experience.exists({ organizer_id: user._id, 'images.public_id': publicId }),
  ]);
  return Boolean(property || experience);
}

exports.handleImageDelete = async (req, res, _next) => {
  try {
    const { public_id } = req.params;

    if (!public_id || !PUBLIC_ID_PATTERN.test(public_id)) {
      return res.status(400).json({ success: false, error: 'Invalid public_id' });
    }

    if (req.user.role !== 'admin' && !(await userOwnsImage(req.user, public_id))) {
      return res.status(403).json({ success: false, error: 'You can only delete your own images' });
    }

    await deleteImage(public_id);

    res.json({ success: true, message: 'Image deleted from Cloudinary' });
  } catch (error) {
    console.error('[Upload] Error deleting from Cloudinary:', error.message);
    res.status(502).json({ success: false, error: 'No se pudo eliminar la imagen de Cloudinary.' });
  }
};
