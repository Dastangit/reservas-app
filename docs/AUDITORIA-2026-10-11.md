# Auditoria completa - Elysio Experiences
Fecha: 2026-10-11 | Alcance: backend completo, frontend (reserva, pago, sesion, i18n, middleware Vercel, SW), despliegue, textos legales.
Metodo: lectura de codigo + tests (36 OK), lint (4 errores), `npm audit` contra registry.npmjs.org (0 vulnerabilidades).
Lo marcado **[VERIFICAR]** no se puede comprobar desde el codigo (estado de produccion).

Resumen: la seguridad mejoro mucho tras la auditoria del 09-oct. El riesgo principal ahora es de negocio y operacion:
la comision del 10% depende de que el host marque "completada", varios flujos visibles estaban rotos y todo depende de un admin manual.

---

## P0 - Inmediato

1. `REASON_LABELS` sin definir en `frontend/js/pages/adminOrphanedPayments.js` (cambio sin commitear) -> la pagina de pagos huerfanos revienta.
2. Credenciales por defecto en `backend/scripts/seed.js` (admin `Admin123!`) y `seedProperties.js` (host `Host123!`). **[VERIFICAR]** si se usaron en produccion y cambiarlas.
3. Propiedades demo (7 en los seeds) probablemente visibles en produccion. **[VERIFICAR]** y desactivar.
4. `jobs/holdExpiry.js` cancelaba a las 3 h reservas PayPal con "Ya pague" pendiente de revision -> dinero cobrado sin reserva.
5. Registro de organizadores imposible: el validador de `/auth/register` solo aceptaba tourist/host.
6. `frontend/vercel.json` y `middleware.js` apuntan a Render; AGENTS.md dice SnapDeploy. **[VERIFICAR]** cual esta vivo.

## P1 - Dinero y modelo de negocio

- Comision depende de que el host marque `completed`; el boton "Mark Complete" del admin daba 403. Resenas tambien dependen de `completed`.
- Cron de comisiones solo recalculaba el mes en curso -> reservas que salen a fin de mes y se completan despues no se cobraban nunca. Comision `paid` que crece seguia `paid`.
- Resenas ciegas solo se revelaban si escribian ambos -> el host podia silenciar malas resenas.
- PayPal manual: imposible conciliar (todas son $7, sin referencia del pagador).
- QvaPay: solo se buscaban las 30 transacciones mas recientes; cada clic creaba otra factura; estado "pagado" sin confirmar con transaccion real **[VERIFICAR]**.
- Bloqueo de inventario gratis: reservas pendientes ilimitadas por turista (propiedades 3 h, excursiones 24 h).
- Reservas `pending_approval` de propiedades sin plazo (los Terminos prometen 24 h).
- "Ingresos" del dashboard solo sumaban reservas `approved`.
- Desintermediacion: el host tiene el telefono del turista y cobra en efectivo (decision de negocio).

## P1 - Flujos rotos visibles

- Sesion muere a las 24 h: el frontend nunca usa el refresh token ni maneja 401; logout no revoca en servidor.
- Errores de validacion se mostraban como "Request failed" (`errors[]` vs `error`).
- Fechas de reserva un dia antes en America (`formatDate` sobre medianoche UTC). `toISOString()` para "hoy".
- Horas de excursiones mal: 09:00 del organizador se guardaba como 09:00 UTC y se mostraba en hora local del visitante. Igual en recurrencias.
- El idioma volvia a ingles al entrar a una pagina publica sin prefijo.
- PropertyCard, Footer, calendario, BookingCard y 4 paginas admin sin i18n.
- Busqueda: mostraba suspendidas, ignoraba fechas bloqueadas, filtraba despues de paginar.
- Host suspendido seguia vendiendo; `createBooking` no comprobaba `suspended`.
- Admin Settings decorativa (no carga valores, campos QvaPay ignorados, fee/moneda/zona sin uso).
- Terminos/privacidad prometen emails, pero `sendEmail` es no-op.
- Host recien registrado recibia token pero no podia operar ni volver a entrar hasta ser aprobado.

## P1 - Seguridad

- IDOR borrado de imagenes: la propiedad se verificaba con `images.public_id` que el propio host controla.
- 2FA: `/2fa/setup` desactivaba 2FA sin contrasena; codigos de respaldo con `Math.random` y en claro; `/verify-2fa` sin limitador.
- Tenant fail-open; `setTenant` antes de `protect`.
- Rate limit probablemente compartido por IP de Vercel **[VERIFICAR]**.
- `errorHandler` filtraba `err.message` en 500; Sentry sin handler Express; sin validacion de env al arrancar.
- Body 10 MB global, `morgan('dev')` en produccion, sin CSP.
- Edicion de propiedad/excursion aprobada sin re-aprobacion.
- `createRecurrence` aceptaba `generate_horizon_days` arbitrario (flood de documentos).
- Fichas publicas exponian propiedades/excursiones no activas con `admin_notes`.
- `/api/users` sin tenant y `limit=0` devolvia todo; paginacion sin limites en general.
- Password minimo 6; cambio de password no invalidaba sesiones; JWT 24 h.
- Login revelaba estado de la cuenta antes de verificar password.
- Generar link de reset no quedaba en audit log.
- `.env.example` versionado con usuario/cluster Atlas, API key Cloudinary y DSN Sentry.

## P2 - Datos y concurrencia

- Cancelar/rechazar/expirar reservas de excursion no atomico -> doble liberacion de cupos.
- `joinWaitlist` sin validar `num_spots_requested` (negativos), duplicados, ni que este llena.
- `num_spots` como string -> error en `$add`.
- Estados de fallo QvaPay (`cancelled`/`canceled`) fuera de los enums de Payment/Booking.
- Borrar propiedad no comprobaba reservas activas.

## P2 - Legal y confianza (no es asesoria legal)

- Cobro via PayPal personal de un tercero para servicio en Cuba: riesgo de politicas PayPal / sanciones.
- Tarifa no reembolsable aun si la reserva se rechaza por causas ajenas al turista (clientes UE).
- Terminos/privacidad sin entidad responsable, jurisdiccion ni lista de encargados (Cloudinary, Sentry, Vercel, Render, QvaPay, PayPal, WhatsApp).
- Contacto Gmail + WhatsApp personal.

## P2 - Operacion y documentacion

- Un unico admin manual aprueba todo (cuello de botella).
- Crons dentro del proceso web (Render free duerme).
- Sitemap pedia `per_page` (el backend lee `limit`) y sin timeout; robots sin Disallow.
- Sin CI; tests solo de exports.
- AGENTS.md desactualizado (decia `$lte`, 23 tests, SendGrid, NOWPayments, SnapDeploy).
- Codigo muerto: `utils/nowpayments.js`, `getHostPayouts` (`full_online`).
- Mongoose 7, `speakeasy` sin mantenimiento.

---

## Correcciones aplicadas (2026-10-11, sin commitear)

Backend
- `REASON_LABELS` definido; textos de pagos huerfanos actualizados a QvaPay.
- Seeds sin contrasenas en el codigo (`SEED_ADMIN_PASSWORD`, demo bloqueado en produccion).
- Expiracion: PayPal con "Ya pague" tiene 72 h extra (y aviso al admin si se cancela); QvaPay se re-consulta antes de cancelar.
- Registro de organizadores habilitado; hosts/organizadores ya no reciben sesion hasta ser aprobados (aviso push al admin).
- `jobs/bookingLifecycle.js`: completa reservas 24 h despues del check-out / de la excursion y publica resenas ciegas a los 14 dias. El admin puede completar reservas.
- Comisiones: se recalcula mes actual + anterior; si una comision pagada crece vuelve a `pending`.
- Rating de propiedad solo con resenas de huespedes; indice unico (booking, reviewer).
- PayPal: "Ya pague" exige ID de transaccion o email del pagador (visible para el admin).
- QvaPay: busqueda en hasta 5 paginas; reutiliza la factura abierta; estados de fallo mapeados a `failed`.
- Limite de 3 reservas sin pagar por turista y 3 reservas de excursion pendientes; maximo 20 cupos por reserva.
- Busqueda: excluye suspendidas y fechas bloqueadas, filtra disponibilidad en la consulta (paginacion correcta). Reservar exige propiedad no suspendida y host activo/aprobado.
- Suspender host suspende sus propiedades; suspender organizador cancela sus excursiones futuras.
- Fichas publicas: no muestran propiedades/excursiones no activas ni campos internos (salvo dueno/admin, via `optionalAuth`).
- Edicion de propiedad publicada marca `changes_pending_review` y avisa al admin; excursion publicada sin reservas vuelve a `pending_approval`.
- IDOR de imagenes: `utils/images.js` solo acepta `public_id` de la carpeta propia; el borrado ya no confia en la URL.
- Horas de excursiones en hora de Cuba (`utils/timezone.js`), incluidas recurrencias (horizonte max. 90 dias, campos en lista blanca).
- Cancelar/rechazar/expirar/aprobar/completar: transiciones atomicas (sin doble liberacion de cupos). Lista de espera validada.
- 2FA: setup no desactiva 2FA activo; codigos de respaldo con `crypto` y hasheados; limitador por cuenta en `/verify-2fa`.
- Rate limit de login/reset/registro por IP + email (mitiga IP compartida de Vercel).
- Tenant fail-closed con cache; `protect` antes de `setTenant`; `/api/users` filtrado por tenant.
- `errorHandler` no expone mensajes de 500 en produccion; Sentry con handler Express; validacion de env al arrancar; body 100 kb; morgan sin query string en produccion; JWT por defecto 1 h.
- Password minimo 8; cambiar password cierra otras sesiones; login sin enumeracion de cuentas.
- Paginacion acotada en todos los listados; audit log al generar link de reset, editar/borrar propiedad y ajustes; borrar propiedad exige no tener reservas activas.
- Admin Settings: `GET /admin/settings`; solo campos reales (branding, idiomas, contacto).
- Dashboard: ingresos = fees cobrados (incluye completadas).
- Eliminado codigo muerto: `utils/nowpayments.js`, `getHostPayouts`. `.env.example` limpio.
- Tests de comportamiento (`tests/logic.test.js`): 50 tests en total. Lint sin errores. CI en `.github/workflows/ci.yml`.

Frontend
- `api.js`: refresco automatico del token en 401, redireccion a login si no se puede, mensajes de validacion legibles, error de red claro. Logout revoca en servidor.
- Login guarda nombre y redirige segun rol; registro de host/organizador muestra "pendiente de aprobacion".
- Fechas de reserva sin desfase de un dia (`formatDate` en UTC, `localDateISO`, `addDaysISO`).
- Excursiones mostradas y editadas en hora de Cuba, con etiqueta.
- El idioma elegido (es/fr) ya no vuelve a ingles en paginas publicas.
- i18n en PropertyCard, BookingCard, Footer y pagina 404; textos legales ya no prometen emails automaticos.
- Checkout PayPal pide referencia; el admin la ve en la tarjeta de reserva y una marca de "editada" en propiedades.
- Admin Settings carga los valores guardados.
- Sitemap: usa `limit`, timeout y no cachea si la API falla. robots.txt con Disallow de rutas privadas.
- `vercel.json`: Content-Security-Policy y Permissions-Policy.

## Pendiente (requiere decision o acceso a produccion)

- **[VERIFICAR]** credenciales del admin/host demo en produccion y desactivar propiedades demo.
- **[VERIFICAR]** que backend esta vivo (vercel.json apunta a Render) y la IP real que ve el rate limit.
- **[VERIFICAR]** string de estado "pagado" de QvaPay con una transaccion real.
- Admins con 2FA activo: los codigos de respaldo antiguos (en claro) dejan de valer; regenerar (disable + setup).
- Resenas duplicadas: correr `npm run reviews:dedupe` (y `-- --fix` si hay) antes/despues de desplegar.
- Politica de reembolso (decision de negocio). Ya hay aviso al admin de reservas pagadas >24 h sin aprobar y de cancelaciones con fee pagado.
- Legal: PayPal de tercero, entidad responsable, jurisdiccion, encargados de datos.
- Contacto de empresa (email/WhatsApp) en `frontend/js/config.js` y textos legales.
- Paginas admin restantes sin i18n (solo espanol); `onclick` inline impiden una CSP sin `unsafe-inline`.
- Backups: `npm run backup` programado en tu PC (o Atlas M10). Crons: `worker.js` + `RUN_JOBS=false` disponible; falta crear el servicio worker en el hosting. Plan de pago en Render.
- Mongoose 7 -> 8, reemplazar `speakeasy`.

## Segunda tanda (2026-10-11)

- Tests de integracion contra MongoDB en memoria (`tests/integration.test.js`); 69 tests en total.
- Mongoose 8; lockfile apuntando a registry.npmjs.org (integridad verificada) + `.npmrc`; Dockerfile con `npm ci`, usuario no root.
- Bloqueo atomico por propiedad (`utils/propertyLock.js`): sin dobles reservas aunque haya varias instancias.
- 2FA con `otplib` + proteccion anti-replay; `speakeasy` eliminado.
- CSP estricta: 87 `onclick` en linea sustituidos por `data-action` delegado.
- Reactivar hosts/organizadores suspendidos; enlaces del turista a detalle, pago y resena (el de resena daba 404).
- Calendario: los errores de bloqueo ya se muestran (antes se borraban). Audit log: metadata escapada (XSS).
- i18n completo del Header, calendario y paginas admin (1085 claves en en/es/fr).
- Apagado limpio, `/health` con estado de Mongo, `worker.js`, `npm run backup`, `npm run reviews:dedupe`, `npm run dev:local`.
- Eliminado `/api/contact` (no lo usaba el frontend y los mensajes se perdian).
- Verificado en navegador con `npm run dev:local`: login por rol, aprobar, menus, idioma, logout, reserva + PayPal + confirmacion admin, renovacion de token, calendario, fechas en America/Havana.
