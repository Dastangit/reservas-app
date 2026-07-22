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

  navigate(path) {
    window.history.pushState({}, '', path);
    this.resolve();
  }

  resolve() {
    const path = window.location.pathname;

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
