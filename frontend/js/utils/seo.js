import i18n from '../i18n.js';

const SITE_URL = 'https://reservas-app-blue.vercel.app';
const DEFAULT_TITLE = 'Elysio Experiences';
const DEFAULT_DESCRIPTION = 'Book authentic accommodations and experiences with trusted hosts across Latin America and the Caribbean.';

function setMetaContent(selector, content) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute('content', content);
}

function ensureCanonical() {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  return link;
}

// Paths that are public-facing but should not appear in search results.
const NOINDEX_PATHS = ['/login'];

function setRobots(noindex) {
  let meta = document.querySelector('meta[name="robots"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');
}

function ensureSchemaScript() {
  let el = document.getElementById('page-schema');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'page-schema';
    document.head.appendChild(el);
  }
  return el;
}

function clearHreflangLinks() {
  document.querySelectorAll('link[rel="alternate"][data-hreflang]').forEach((el) => el.remove());
}

function setHreflangLinks(strippedPath) {
  clearHreflangLinks();
  const variants = [
    { hreflang: 'en', locale: 'en' },
    { hreflang: 'es', locale: 'es' },
    { hreflang: 'fr', locale: 'fr' },
    { hreflang: 'x-default', locale: 'en' },
  ];
  for (const { hreflang, locale } of variants) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', hreflang);
    link.setAttribute('href', `${SITE_URL}${i18n.localizePath(strippedPath, locale)}`);
    link.setAttribute('data-hreflang', 'true');
    document.head.appendChild(link);
  }
}

const seo = {
  /**
   * Set per-page SEO metadata. Call this from a page's meta() hook.
   * @param {Object} opts
   * @param {string} [opts.title] - Page-specific title (site name is appended automatically).
   * @param {string} [opts.description] - Page-specific meta description.
   * @param {string} [opts.path] - Path used to build canonical/og:url. Defaults to current location.
   * @param {boolean} [opts.noindex] - Force noindex/index. Defaults to noindex for non-public routes.
   * @param {Object} [opts.schema] - Optional JSON-LD object rendered as this page's structured data.
   *   Cleared automatically on pages that don't provide one.
   */
  set({ title, description, path, schema, noindex } = {}) {
    const finalTitle = title ? `${title} | ${DEFAULT_TITLE}` : DEFAULT_TITLE;
    const finalDescription = description || DEFAULT_DESCRIPTION;
    const finalPath = path || window.location.pathname;
    const url = `${SITE_URL}${finalPath}`;

    document.title = finalTitle;
    setMetaContent('meta[name="description"]', finalDescription);
    setMetaContent('meta[property="og:title"]', finalTitle);
    setMetaContent('meta[property="og:description"]', finalDescription);
    setMetaContent('meta[property="og:url"]', url);
    setMetaContent('meta[name="twitter:title"]', finalTitle);
    setMetaContent('meta[name="twitter:description"]', finalDescription);

    ensureCanonical().setAttribute('href', url);
    ensureSchemaScript().textContent = schema ? JSON.stringify(schema) : '';

    const strippedPath = i18n.stripLocaleFromPath(finalPath);
    // Dashboards, admin, booking flow and unknown routes (404) are noindex by default.
    setRobots(noindex ?? (!i18n.isLocalizablePath(strippedPath) || NOINDEX_PATHS.includes(strippedPath)));
    if (i18n.isLocalizablePath(strippedPath)) {
      setHreflangLinks(strippedPath);
    } else {
      clearHreflangLinks();
    }
  },

  reset() {
    this.set({});
  },
};

window.seo = seo;
export default seo;
