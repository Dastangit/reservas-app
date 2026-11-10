const { searchAddress, GeoBusyError } = require('../utils/nominatim');
const { normalizeCountry } = require('../utils/countries');

const LANGS = ['es', 'en', 'fr'];

// GET /api/geo/search?q=...&country=MX&lang=es
// Para el formulario de anfitriones y organizadores: busca una direccion y
// devuelve candidatos con su punto. Nunca se llama a Nominatim desde el navegador.
exports.search = async (req, res, next) => {
  try {
    const lang = LANGS.includes(req.query.lang) ? req.query.lang : 'en';
    const results = await searchAddress(req.query.q, {
      lang,
      country: normalizeCountry(req.query.country) || undefined,
    });
    res.json({ success: true, data: { results } });
  } catch (error) {
    if (error instanceof GeoBusyError) {
      return res.status(429).json({ success: false, error: error.message });
    }
    if (error.name === 'TimeoutError' || error.name === 'AbortError' || /Nominatim|fetch failed/.test(error.message)) {
      console.error('[Geo] Busqueda de direccion fallida:', error.message);
      return res.status(502).json({ success: false, error: 'Address search is unavailable right now' });
    }
    next(error);
  }
};
