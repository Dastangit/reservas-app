# Pendientes

Lista viva (31 oct 2026). Léela al retomar y marca lo que se termine. La mudanza al VPS tiene su propia lista en `docs/MUDANZA-VPS.md`.

## Ahora (sin servidor)

- [ ] **Telegram en Render:** poner `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (los dos valores están en `backend/.env`; el chat es el grupo «Elysio Experiences») en Render → Environment. Sin eso, producción no manda avisos a Telegram. Después, comprobar con una acción real (por ejemplo, una solicitud de cambio de contraseña) que llegue al grupo sin datos personales.
- [ ] **Cambiar el usuario de MongoDB Atlas.** El repositorio es público y una versión vieja de `backend/.env.example` dejó a la vista el nombre del usuario actual y el del clúster, sin la contraseña (tenía `<db_password>`). En este orden, para no cortar el servicio:
  1. Atlas → Database Access → usuario nuevo (p. ej. `reservas_app`), contraseña autogenerada, permisos **readWrite solo sobre la base `Dats`**.
  2. Render → Environment → `MONGODB_URI` con el usuario y la contraseña nuevos. Comprobar que `https://booking-platform-f8co.onrender.com/health` diga `"db":"connected"`.
  3. Lo mismo en `backend/.env` de la PC y probar el respaldo: `systemctl --user start reservas-respaldo.service`.
  4. Borrar el usuario viejo en Atlas.
  No hace falta reescribir el historial de git: sin la contraseña, el dato no sirve, y menos tras borrar el usuario.
- [ ] **Secreto del proxy (`PROXY_SECRET`):** el mismo valor en Vercel (Settings → Environment Variables, Production) y en Render. Con él, el límite de peticiones cuenta la IP real de cada usuario (`backend/utils/clientIp.js`). Sin él todo funciona igual que antes.
- [ ] **2FA:** los admins que lo tengan activo deben desactivarlo y volver a activarlo para recibir códigos de respaldo nuevos (los anteriores a la auditoría de octubre dejaron de valer).
- [ ] **Opcional:** hacer privado el repositorio (GitHub → Settings → General → Danger Zone → Change visibility). Vercel y Render siguen funcionando.
- [ ] **Opcional:** otplib 13 cuando la dependencia `@scure/base` publique CommonJS o el proyecto use ESM (ver el comentario en `controllers/authController.js`).

## Con el VPS

- [ ] Mudar el backend: `docs/MUDANZA-VPS.md`.
- [ ] Respaldo diario en el VPS con copia a Cloudflare R2: `docs/RESPALDOS.md`, «Pendiente: con el VPS».
- [ ] Atlas → Network Access: dejar solo la IP del VPS (hoy tiene que aceptar Render y la PC, que cambian de IP).
- [ ] Monitor de UptimeRobot sobre `/health`.

## Hecho (31 oct 2026)

- Revisión completa (`docs/REVISION-2026-10-31.md`) y sus arreglos (PR #3 y siguientes). Cuentas y propiedades demo borradas de producción; solo queda el admin.
- Plataforma global: país por anuncio, zona horaria por excursión y más tipos de alojamiento (PR #4). Modo oscuro con contraste AA (PR #5).

- Auditoría de octubre, Node 24, carpeta `deploy/` y `api-base.js` en producción (PR #1).
- Avisos del panel también por Telegram, sin datos personales; respaldo diario de Atlas en la PC con restauración probada; ESLint 10, Jest 30 y Supertest 7 (PR #2).
- Alerta de GitHub por un secreto: era un dato de prueba inventado (falso positivo, cerrada).
