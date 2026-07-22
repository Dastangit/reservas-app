const i18n = {
  currentLang: localStorage.getItem('lang') || 'en',
  translations: {},

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
};

window.i18n = i18n;
export default i18n;
