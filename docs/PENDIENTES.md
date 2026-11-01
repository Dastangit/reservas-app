# Pendientes

Lista viva (actualizada el 1 nov 2026). Léela al retomar y marca lo que se termine. La mudanza al VPS tiene su propia lista en `docs/MUDANZA-VPS.md`; el estado de la revisión del 31-oct está en `docs/REVISION-2026-10-31.md`.

## Ahora

- [ ] **Cambiar el usuario de MongoDB Atlas.** El repositorio es público y una versión vieja de `backend/.env.example` dejó a la vista el nombre del usuario actual y el del clúster, sin la contraseña (tenía `<db_password>`). En este orden, para no cortar el servicio:
  1. Atlas → Database Access → usuario nuevo (p. ej. `reservas_app`), contraseña autogenerada, permisos **readWrite solo sobre la base `Dats`**.
  2. Render → Environment → `MONGODB_URI` con el usuario y la contraseña nuevos. Comprobar que `https://booking-platform-f8co.onrender.com/health` diga `"db":"connected"`.
  3. Lo mismo en `backend/.env` de la PC y probar el respaldo: `systemctl --user start reservas-respaldo.service`.
  4. Borrar el usuario viejo en Atlas.
  No hace falta reescribir el historial de git: sin la contraseña, el dato no sirve, y menos tras borrar el usuario.

## Cuando se pueda

- [ ] **Pago real con QvaPay:** hacer uno de prueba y confirmar cómo llega un pago «pagado» (aviso en `backend/utils/qvapay.js`).
- [ ] **2FA en la cuenta admin** (`elysio.support@gmail.com`): activarlo desde el perfil y guardar los códigos de respaldo.
- [ ] **Opcional:** hacer privado el repositorio (GitHub → Settings → General → Danger Zone → Change visibility). Vercel y Render siguen funcionando. Los datos internos quitados de los documentos siguen en el historial de git.
- [ ] **Opcional:** borrar en Cloudinary las fotos de las 8 propiedades eliminadas el 31-oct (ya no se ven en la web).
- [ ] **Opcional:** otplib 13 cuando la dependencia `@scure/base` publique CommonJS o el proyecto use ESM (ver el comentario en `controllers/authController.js`).
- [ ] **Opcional:** las vulnerabilidades de `npm audit` que quedan son solo de herramientas de desarrollo (Jest, ESLint, nodemon); revisarlas cuando salgan versiones que las arreglen sin bajar de versión mayor.

## Decisiones de negocio

- [ ] **Cobro con tarjeta para turistas de cualquier país.** Hoy solo hay PayPal manual y QvaPay (pensado para Cuba). Una pasarela como Stripe exige una empresa en un país donde opere.
- [ ] **Sanciones de EE. UU. (OFAC):** consultarlo antes de aceptar turistas o pagos de EE. UU. para propiedades en Cuba.
- [ ] **Dominio `elysioexperiences.com`:** libre el 31-oct (~$11/año en Cloudflare). Comprarlo con una cuenta y una tarjeta de fuera de Cuba. Con él, un correo de marca (p. ej. `soporte@elysioexperiences.com`) y cambiar el contacto público en el panel admin → Ajustes.
- [ ] **De la auditoría de octubre:** PayPal personal, entidad responsable, política de reembolso y contacto de empresa.

## Con el VPS

- [ ] Mudar el backend: `docs/MUDANZA-VPS.md`.
- [ ] Respaldo diario en el VPS con copia a Cloudflare R2: `docs/RESPALDOS.md`, «Pendiente: con el VPS».
- [ ] Atlas → Network Access: dejar solo la IP del VPS (hoy tiene que aceptar Render y la PC, que cambian de IP).
- [ ] Monitor de UptimeRobot sobre `/health`.

## Hecho

- 1-nov: PRs #4, #5 y #6 integrados; `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` puestos en Render; `PROXY_SECRET` en Vercel y Render, con la cabecera puesta desde `frontend/middleware.js` (PRs #7 y #8): el límite de peticiones ya cuenta la IP real del usuario y no acepta cabeceras falsificadas.

- Revisión completa (`docs/REVISION-2026-10-31.md`) y sus arreglos: fechas, feedback del admin, series recurrentes, confirmación de reserva y textos sin promesas de correo (PR #3); IP real detrás de Vercel, QvaPay 503, ganancias del host, `jti` en los tokens, página de reseña, lint en 0 y documentos (PR #6).
- Producción limpia: borradas las cuentas y propiedades de prueba; solo queda el admin, con contraseña nueva.
- Plataforma global: país por anuncio, zona horaria por excursión, filtro por país y más tipos de alojamiento (PR #4). Modo oscuro con contraste AA en ambos temas (PR #5).
- Auditoría de octubre, Node 24, carpeta `deploy/` y `api-base.js` en producción (PR #1).
- Avisos del panel también por Telegram, sin datos personales; respaldo diario de Atlas en la PC con restauración probada; ESLint 10, Jest 30 y Supertest 7 (PR #2).
- Alerta de GitHub por un secreto: era un dato de prueba inventado (falso positivo, cerrada).
