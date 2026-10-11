# Auditoria SEO, codigo y seguridad - Elysio Experiences
Fecha: 2026-10-09 | Alcance: frontend (Vercel), backend (Render), middleware, sitio en vivo.
Metodo: lectura de codigo + pruebas HTTP contra reservas-app-blue.vercel.app. Lo marcado **[VERIFICAR]** es hipotesis con prueba sugerida.

---

## P0 - Corregir antes de captar hosts reales

### 1. XSS almacenado (alto)
- 120 usos de `innerHTML` y **no existe ninguna funcion de escape**. Plantillas como `<h3>${property.name}</h3>`, `alt="${p.name}"`, `${exp.title}`, `${r.name}` insertan texto del usuario sin escapar (PropertyCard.js, adminProperties.js, adminDashboard.js, experienceBooking.js, adminPasswordResets.js, etc.).
- Los JWT (`token`, `refresh_token`) estan en `localStorage`. Un host que ponga `<img src=x onerror=...>` como nombre de propiedad ejecuta JS en el navegador del admin al revisarla y roba su sesion.
- Prueba: crear propiedad con nombre `<img src=x onerror=alert(1)>` y abrir el panel admin.
- Solucion:
  1. Crear `utils/escape.js` con `escapeHtml()` y aplicarlo a todo campo de usuario (name, title, description, comment, notes, nombres de usuario, feedback).
  2. Anadir CSP en `vercel.json` (ver punto 10) como segunda barrera.
  3. Largo plazo: tokens en cookies httpOnly + SameSite.

### 2. Rate limit por IP probablemente compartida [VERIFICAR]
- Trafico: navegador -> Vercel (rewrite) -> Render. Con `trust proxy = 1`, `req.ip` en Render puede ser la IP de salida de Vercel, no la del usuario.
- Si es asi: `loginLimiter` (5 intentos / 15 min) y `apiLimiter` (100 / min) se aplican a **todos los usuarios juntos**. Encaja con el bloqueo de registro ya observado.
- Prueba (2 min): llamar `/api/properties` desde el PC y desde el telefono con datos moviles; si `Ratelimit-Remaining` baja en conjunto, la IP es compartida. Anadir temporalmente un log de `req.ip` y `req.ips`.
- Solucion: ajustar `trust proxy` al numero real de saltos, o usar `keyGenerator` con la IP del cliente que reenvia Vercel (validada). Aplicar limites tambien por cuenta/email en login.

### 3. Aislamiento multi-tenant "fail-open"
- `filterByTenant` omite el filtro si `req.tenantId` es undefined.
- `setTenant` cae a un tenant por defecto con dominio `elysioexperiences.com` (aun no comprado/configurado). Si ese registro no existe, `tenantId` queda vacio y las consultas devuelven datos de **todos** los tenants.
- Ademas `req.hostname` detras del proxy de Vercel puede ser el host de Render, no el dominio publico [VERIFICAR].
- Solucion: fail-closed (si no hay tenant, responder 400/500), variable `DEFAULT_TENANT_ID`, leer `X-Forwarded-Host`, y test automatico de aislamiento entre dos tenants.

### 4. Subida/borrado de imagenes
- `DELETE /api/uploads/image/:public_id` permite a cualquier host/organizador borrar **cualquier** imagen de Cloudinary (IDOR). Falta verificar propiedad.
- `fileFilter` solo mira `mimetype` (lo controla el cliente) y acepta `image/svg+xml` (puede llevar scripts).
- Solucion: permitir solo jpeg/png/webp, validar magic bytes (paquete `file-type`), guardar `public_id` por propiedad y comprobar propietario antes de borrar; carpeta por tenant/usuario.

### 5. Manejo de errores y monitoreo
- `errorHandler` devuelve `err.message` en errores 500 (puede filtrar detalles internos). En produccion devolver mensaje generico.
- Sentry se inicializa pero **no** hay `Sentry.setupExpressErrorHandler(app)`, asi que los errores capturados por tu errorHandler probablemente nunca llegan a Sentry [VERIFICAR lanzando un error de prueba].
- No hay validacion de variables de entorno al arrancar (`JWT_SECRET`, `MONGODB_URI`...). Fallar al inicio si faltan.

---

## P1 - SEO (antes de mover trafico)

| # | Hallazgo | Solucion |
|---|----------|----------|
| 6 | URL base `reservas-app-blue.vercel.app` hardcodeada en index.html, robots.txt, middleware.js, JSON-LD, canonical, OG, hreflang | Centralizar en una constante/env (`SITE_URL`). Al comprar `elysioexperiences.com`: redirigir 301 desde vercel.app, actualizar sitemap, robots, canonical y registrar en Search Console + Bing Webmaster |
| 7 | SPA renderizada en cliente: el HTML inicial esta vacio (`<main id="app">`). Google renderiza JS pero con retraso; otros buscadores y bots no | Extender el middleware (ya existe para redes sociales) para servir un snapshot HTML con contenido y JSON-LD a Googlebot/Bingbot en home, property y experiences. Verificar con "Inspeccion de URL" tras el dominio |
| 8 | Rutas inexistentes devuelven HTTP 200 (soft 404). Mitigado: `seo.js` pone noindex en cliente | Hacer que el middleware responda 404 a rutas desconocidas del espacio publico |
| 9 | Sitemap fragil: si Render esta dormido, el fetch falla y se sirve un sitemap **solo estatico cacheado 1 hora**. En vivo: 48 URLs = 8 propiedades + paginas estaticas, **0 experiencias** | `AbortSignal.timeout`, `cache-control: no-store` cuando falle la API, `s-maxage` + `stale-while-revalidate` cuando funcione. Revisar por que no salen experiencias (filtro de status) |
| 10 | `robots.txt` sin `Disallow` para `/api/`, `/admin`, `/host`, `/profile`, flujos de reserva | Anadir Disallow (el noindex por JS solo funciona si el bot puede rastrear y ejecutar JS) |
| 11 | Datos estructurados: Organization, WebSite, FAQPage, LodgingBusiness, Event/Offer presentes (bien) | Comprobar en Rich Results Test; anadir `aggregateRating`, `image`, `priceRange` en propiedades si faltan; `sameAs` cuando existan redes |
| 12 | Core Web Vitals: Google Fonts bloquea render; imagenes de relleno en `via.placeholder.com` (dependencia externa no confiable) | `font-display: swap` / self-host; usar un placeholder local; dimensiones width/height en imagenes |
| 13 | Contenido publico (markdown para IA) menciona moneda `CUP` y un WhatsApp personal | Quitar `CUP` si no es parte del posicionamiento; usar numero/correo de negocio |

Bien resuelto: title/description/OG/Twitter, hreflang EN/ES/FR en sitemap y por pagina, canonical dinamico, noindex en rutas privadas, llms.txt, markdown negotiation, robots con bots de IA, HSTS (Vercel).

---

## P1 - Seguridad

| # | Hallazgo | Solucion |
|---|----------|----------|
| 14 | Cabeceras: solo nosniff, X-Frame-Options, Referrer-Policy. **Sin CSP ni Permissions-Policy** | CSP restrictiva (self + Google Fonts + Cloudinary + Sentry), `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| 15 | Service Worker cachea **todas** las GET same-origin, incluidas `/api/*` autenticadas (reservas, perfil). Quedan en cache tras logout y se sirven obsoletas offline | Excluir `/api/`; limpiar caches al cerrar sesion; versionar `CACHE_NAME` |
| 16 | Password minimo 6 caracteres. `/register`, `/refresh` y `/verify-2fa` sin limiter propio (2FA: 6 digitos) | Minimo 8-10 + lista de claves comunes; limiters por ruta y por cuenta; bloqueo tras N codigos 2FA fallidos |
| 17 | `express.json({ limit: '10mb' })` global | 100 kb por defecto; limite mayor solo en rutas que lo necesiten |
| 18 | Webhook QvaPay: buen diseno (re-consulta autenticada). Pendientes: el TODO del string "pagado" sin confirmar con pago real, y no se valida el monto | Probar con una transaccion real; exigir `amount >= fee` |
| 19 | Token JWT de acceso 24 h | 15-60 min + refresh con rotacion e invalidacion en logout |
| 20 | `morgan('dev')` en produccion registra URLs con query | `morgan('combined')` y sin query sensibles (tokens de reset) |

Bien resuelto: `.env` nunca estuvo en git, helmet, CORS restringido, `express-mongo-sanitize`, JWT con algoritmo fijado, token 2FA separado de sesion, bcrypt, `trust proxy` limitado.

---

## P2 - Operacion (errores probables y plan)

| Riesgo | Sintoma | Plan |
|--------|---------|------|
| Render free duerme | Primera carga 30-60 s, cron jobs muertos, sitemap/markdown vacios para bots | UptimeRobot (ya) + pasar a plan de pago antes del lanzamiento; o mover crons a Render Cron Jobs |
| MongoDB Atlas M0 sin backups | Perdida de datos irrecuperable | `mongodump` programado a almacenamiento externo, o subir a M10 |
| Limite de conexiones M0 / sin indices en consultas nuevas | Lentitud bajo carga | Revisar `explain()` en busqueda; monitorear conexiones |
| Cambio de dominio | Tenant por defecto no coincide, CORS, canonical, cookies | Checklist: Tenant.domain, `FRONTEND_URL`, CORS, `SITE_URL`, Search Console |
| Cloudinary bloquea por geografia o cuota | Subidas fallan | Fallback "pegar URL" ya existe; monitorear cuota |
| Pagos manuales (PayPal) | Conciliacion lenta, errores humanos | Cola admin con SLA, `OrphanedPayment` ya existe; documentar proceso |
| Dependencias | No se pudo ejecutar `npm audit` (registro del sandbox lo bloquea) | Ejecutar `npm audit --omit=dev` en tu PC y activar Dependabot |
| Sin CI | Regresiones pasan a produccion | GitHub Actions: lint + jest en cada PR |
| Cumplimiento | Sanciones y pagos transfronterizos (tema ya senalado) | Revision legal antes de escalar; screening segun mercado |

---

## Orden recomendado
1. Escapar HTML + CSP (punto 1, 14).
2. Verificar IP/rate limit y tenant fail-closed (2, 3).
3. Subidas e IDOR (4); errores/Sentry (5).
4. Dominio propio + SITE_URL centralizado + Search Console (6).
5. Snapshot para crawlers y sitemap robusto (7, 9).
6. Resto de P1/P2.
