// Normaliza el array images que manda un host u organizador. El public_id de
// Cloudinary es lo que se usa para autorizar el borrado de la imagen, asi que
// solo se acepta si esta en la carpeta del propio usuario (o si ya estaba en
// el documento, para no romper fotos antiguas). Antes se aceptaba cualquiera,
// y copiar el public_id de otra propiedad permitia borrar fotos ajenas.
const MAX_IMAGES = 20;

const isHttpUrl = (value) => {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

function sanitizeImages(images, userId, existingImages = []) {
  if (!Array.isArray(images)) return [];
  const ownPrefix = `reservas-app/uploads/${userId}/`;
  const existingIds = new Set((existingImages || []).map((img) => img?.public_id).filter(Boolean));

  return images
    .filter((img) => img && isHttpUrl(img.url))
    .slice(0, MAX_IMAGES)
    .map((img, index) => {
      const publicId = typeof img.public_id === 'string' ? img.public_id : '';
      const keepId = publicId && (publicId.startsWith(ownPrefix) || existingIds.has(publicId));
      return {
        url: String(img.url).slice(0, 1000),
        public_id: keepId ? publicId : undefined,
        title: img.title ? String(img.title).slice(0, 200) : undefined,
        order: Number.isFinite(Number(img.order)) ? Number(img.order) : index,
        is_primary: Boolean(img.is_primary),
      };
    });
}

module.exports = { sanitizeImages };
