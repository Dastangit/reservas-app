# CHANGELOG — Da-El World Travelers

Todos los cambios notables de la implementación.

---

## [1.1.3] - 2026-07-10

### Changed
- **Unified admin email**: Consolidado a un solo correo `supportdaelworld@gmail.com` para ambos admins (cuenta compartida)
- **WhatsApp removed**: Números de WhatsApp removidos temporalmente hasta definir número único
- **Footer**: Muestra solo email de contacto (sin WhatsApp)
- **Landing page**: Ahora usa `i18n.t()` para todos los textos (hero, pasos, CTA)
- **Language switcher**: Ahora recarga la página al cambiar idioma para actualizar todo el contenido
- **Seed script**: Crea un solo admin con email compartido en vez de dos admins separados

### Fixed
- **JSON syntax errors**: Corregidas trailing commas en `en.json` y `es.json` que rompían el parseo de todas las traducciones
- **i18n for new pages**: HowItWorks, FAQ, Terms y Privacy ahora usan `i18n.t()` para todo el contenido (EN/ES/FR)

### Files modified
- `frontend/js/config.js` - Email unificado, WhatsApp removido
- `frontend/js/components/Footer.js` - Email unificado, WhatsApp removido
- `frontend/js/components/Header.js` - Language switcher con recarga de página
- `frontend/js/app.js` - Función `rerenderCurrentPage` agregada
- `frontend/js/pages/landing.js` - Todos los textos ahora usan `i18n.t()`
- `frontend/js/pages/howItWorks.js` - Full i18n con `i18n.t()`
- `frontend/js/pages/faq.js` - Full i18n con `i18n.t()`
- `frontend/js/pages/terms.js` - Full i18n con `i18n.t()`
- `frontend/js/pages/privacy.js` - Full i18n con `i18n.t()`
- `frontend/js/pages/bookingConfirmation.js` - Email actualizado
- `frontend/js/pages/bookingSummary.js` - Email actualizado
- `frontend/js/pages/propertyDetail.js` - Email actualizado
- `frontend/locales/en.json` - Traducciones completas + email unificado
- `frontend/locales/es.json` - Traducciones completas + email unificado
- `frontend/locales/fr.json` - Traducciones completas + email unificado
- `backend/scripts/seed.js` - Un solo admin con email compartido
- `backend/controllers/authController.js` - admin_email actualizado

---

## [1.1.2] - 2026-07-08

### Added
- **How It Works page**: Página detallada `/how-it-works` con explicación completa para turistas y anfitriones
- **Terms of Service page**: Página `/terms` con términos de servicio completos (edad 16+, fee no reembolsable, etc.)
- **Privacy Policy page**: Página `/privacy` con política de privacidad (cookies esenciales, derechos del usuario, etc.)
- **FAQ page**: Página `/faq` con 8 preguntas frecuentes y respuestas detalladas
- **Footer legal links**: Agregados links a Terms, Privacy, FAQ, How It Works en el footer
- **CSS styles**: Estilos para páginas legales, FAQ con accordion, How It Works con cards
- **i18n translations**: Traducciones para nuevas páginas en EN, ES, FR

### Files created
- `frontend/js/pages/howItWorks.js` - Página How It Works
- `frontend/js/pages/terms.js` - Términos de Servicio
- `frontend/js/pages/privacy.js` - Política de Privacidad
- `frontend/js/pages/faq.js` - Preguntas Frecuentes

### Files modified
- `frontend/js/app.js` - Agregadas rutas para 4 nuevas páginas
- `frontend/js/components/Footer.js` - Agregados links legales
- `frontend/locales/en.json` - Traducciones nuevas páginas
- `frontend/locales/es.json` - Traducciones nuevas páginas
- `frontend/locales/fr.json` - Traducciones nuevas páginas
- `frontend/css/styles.css` - Estilos para páginas legales y FAQ

---

## [1.1.1] - 2026-07-08

### Changed
- **Contact info updated**: Todos los datos de contacto actualizados con información real
  - Admin 1: admindastan@daelworld.com / +53 5864 8303
  - Admin 2: soporteisdiel@daelworld.com / +53 5359 0287
- **Social media**: Instagram y Facebook actualizados con @daelworldtravelers
- **Seed script**: Ahora crea 2 cuentas de admin en vez de 1
- **Tenant admin_email**: Actualizado a admindastan@daelworld.com
- **SendGrid from**: noreply@daelworld.com

### Files modified
- `frontend/js/config.js` - emails, WhatsApp, redes sociales
- `frontend/js/components/Footer.js` - email de contacto
- `frontend/js/pages/propertyDetail.js` - email de contacto
- `frontend/js/pages/bookingSummary.js` - email de contacto
- `frontend/js/pages/bookingConfirmation.js` - email de contacto
- `backend/scripts/seed.js` - 2 admins, emails actualizados
- `backend/controllers/authController.js` - admin_email del tenant
- `backend/.env.example` - SENDGRID_FROM_EMAIL

---

## [1.1.0] - 2026-07-08

### Added
- **Email notifications**: Conectados 3 templates SendGrid (confirmación, aprobación, rechazo) desde controllers
- **Rate limiting**: express-rate-limit con 5 req/15min para auth y 100 req/min para API
- **Search endpoint**: GET /api/search con filtros avanzados (check_in, check_out, num_guests, city, price, type, amenities, rating, sort)
- **Hold expiration cron**: Job cada 5 minutos que cancela holds vencidos (pending_payment + hold_expires_at < now)
- **Contact endpoint**: POST /api/contact - formulario público que envía email al admin
- **Refresh token rotation**: Tokens se invalidan al usar uno nuevo (campo refresh_token en User)
- **config.js**: Configuración centralizada del frontend (branding, fees, features flags, social links)
- **theme.css**: Variables CSS separadas de styles.css para theming fácil
- **i18n completo**: Sistema de internacionalización EN/ES/FR con selector de idioma en Header
- **23 unit tests**: Tests para controllers, models, middleware, utils, routes, jobs

### Fixed
- **Booking fee_amount**: Default cambiado de $5 a $10 USD (especificación dice $10)
- **User email unique**: Cambiado de unique global a compound index {tenant_id, email} (multi-tenant correcto)
- **checkAvailability**: Ahora verifica bookings activos (pending_payment, pending_approval, approved), no solo blocked_dates
- **Host auto-approve**: Host ya no puede enviar status: "active" al actualizar propiedad (se filtra del body)

### Changed
- **authController.js**: Login guarda refresh_token en DB, logout lo limpia, refresh rota token
- **bookingController.js**: approve/reject ahora populate tourist_id y envían email
- **adminController.js**: approveProperty/rejectProperty ahora envían email al host
- **server.js**: Agregadas rutas /api/search, /api/contact, rate limiters, cron job
- **index.html**: Agregados links a theme.css y config.js

### Packages
- express-rate-limit@8.5.2
- node-cron@4.6.0

---

## [1.0.0] - 2026-07-03

### Added
- Commit inicial: Backend Node.js + Express + MongoDB
- Frontend SPA vanilla JS con 28 páginas
- Auth JWT con register, login, refresh, logout
- CRUD propiedades con aprobación de admin
- Sistema de reservas con hold de 3 horas
- Sistema de reseñas ciegas (Airbnb-style)
- Sistema de feedback admin-only
- Panel admin completo (dashboard, aprobaciones, hosts, settings)
- Multi-tenant middleware
- PWA con Service Worker
- 4 propiedades de demo sembradas
