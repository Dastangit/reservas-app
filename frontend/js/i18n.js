const i18n = {
  currentLang: localStorage.getItem('lang') || 'en',
  translations: {},

  // Locales that get a URL prefix (e.g. /es/faq). 'en' is the default and stays unprefixed.
  prefixedLocales: ['es', 'fr'],

  // Public, marketing/booking-browse pages that have real translated content and
  // matter for SEO/hreflang. Authenticated dashboards (tourist/host/organizer/admin)
  // and transactional flows (booking, payment, etc.) are intentionally excluded —
  // their i18n continues to work exactly as before, purely via localStorage, with
  // no URL involvement at all.
  localizablePaths: ['/', '/search', '/experiences', '/how-it-works', '/faq', '/terms', '/privacy', '/register', '/login'],

  async load(lang) {
    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) throw new Error('Failed to load translations');
      this.translations[lang] = await response.json();
    } catch (error) {
      console.error(`i18n: Failed to load ${lang}:`, error);
    }
  },

  async init() {
    const savedLang = localStorage.getItem('lang') || 'en';
    this.currentLang = savedLang;

    await Promise.all([
      this.load('en'),
      this.load('es'),
      this.load('fr'),
    ]);

    document.documentElement.lang = this.currentLang;
  },

  t(key) {
    const keys = key.split('.');
    let value = this.translations[this.currentLang];

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === undefined && this.currentLang !== 'en') {
      value = this.translations.en;
      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k];
        } else {
          return key;
        }
      }
    }

    return value ?? key;
  },

  setLang(lang) {
    if (this.translations[lang]) {
      this.currentLang = lang;
      localStorage.setItem('lang', lang);
      document.documentElement.lang = lang;
      window.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
    }
  },

  getLangs() {
    return [
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
      { code: 'fr', label: 'Français' },
    ];
  },

  // ---- URL <-> locale helpers ----

  /** Reads the locale prefix (if any) from a pathname. Defaults to 'en'. */
  getLocaleFromPath(pathname) {
    const seg = pathname.split('/')[1];
    return this.prefixedLocales.includes(seg) ? seg : 'en';
  },

  /** Removes a known locale prefix from a pathname, if present. */
  stripLocaleFromPath(pathname) {
    const parts = pathname.split('/');
    if (this.prefixedLocales.includes(parts[1])) {
      const rest = '/' + parts.slice(2).join('/');
      return rest.length > 1 ? rest.replace(/\/$/, '') : '/';
    }
    return pathname;
  },

  /** Whether this (unprefixed) path is one we generate locale-prefixed URLs for. */
  isLocalizablePath(strippedPath) {
    if (this.localizablePaths.includes(strippedPath)) return true;
    if (strippedPath.startsWith('/property/')) return true;
    if (strippedPath.startsWith('/experiences/')) return true;
    return false;
  },

  /** Builds the URL for `pathname`'s content in `locale` (any existing prefix is replaced). */
  localizePath(pathname, locale) {
    const stripped = this.stripLocaleFromPath(pathname);
    if (locale === 'en') return stripped;
    return stripped === '/' ? `/${locale}` : `/${locale}${stripped}`;
  },
};

window.i18n = i18n;
export default i18n;
