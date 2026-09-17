import i18n from './i18n.js';

class Router {
  constructor() {
    this.routes = [];
    this.currentRoute = null;
    window.addEventListener('popstate', () => this.resolve());
  }

  addRoute(pattern, handler) {
    const paramNames = [];
    let regexStr;

    if (pattern === '*') {
      regexStr = '.*';
    } else {
      regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });
    }

    this.routes.push({
      pattern,
      regex: new RegExp('^' + regexStr + '$'),
      paramNames,
      handler,
    });
    return this;
  }

  /**
   * Normal in-app navigation. If the current page is a localizable one and the
   * target is too, the current locale prefix is preserved automatically — pages
   * never need to know or care about locale prefixes. Non-localizable pages
   * (dashboards, booking flow, admin, etc.) are never prefixed, matching the
   * existing localStorage-only i18n behavior for the authenticated app.
   */
  navigate(path) {
    const currentLocale = i18n.getLocaleFromPath(window.location.pathname);
    const strippedPath = i18n.stripLocaleFromPath(path);
    const finalPath = (currentLocale !== 'en' && i18n.isLocalizablePath(strippedPath))
      ? i18n.localizePath(strippedPath, currentLocale)
      : strippedPath;
    this.navigateRaw(finalPath);
  }

  /** Navigates to `path` exactly as given, with no locale auto-prefixing. Used by the language switcher. */
  navigateRaw(path) {
    window.history.pushState({}, '', path);
    this.resolve();
  }

  resolve() {
    const rawPath = window.location.pathname;
    const locale = i18n.getLocaleFromPath(rawPath);
    const path = i18n.stripLocaleFromPath(rawPath);

    if (i18n.isLocalizablePath(path) && i18n.currentLang !== locale) {
      i18n.setLang(locale);
    }

    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        this.currentRoute = path;
        route.handler(params);
        return;
      }
    }

    const fallback = this.routes.find(r => r.pattern === '*');
    if (fallback) {
      fallback.handler({});
    }
  }

  init() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-link]');
      if (link) {
        e.preventDefault();
        this.navigate(link.getAttribute('href'));
      }
    });

    this.resolve();
  }
}

const router = new Router();
export default router;
