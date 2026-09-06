# CHECKLIST DE LANZAMIENTO
## Elysio Experiences

**Fecha:** Agosto 2026
**Estado:** En preparación — plataforma construida, pendiente de verificación antes de usuarios reales

---

## Branding — completo

- [x] Nombre unificado: "Elysio Experiences" (config, HTML, PWA, header, footer, 3 idiomas)
- [x] Logo/ícono reales conectados (`logo-real.jpeg`, `icon-real.jpeg`)
- [x] Footer rediseñado a tema claro
- [x] Posicionamiento "Latinoamérica y el Caribe" en todo el copy público
- [x] SEO: título y meta description genéricos
- [ ] Dominio propio (pendiente a propósito — se usa el subdominio de Vercel por ahora)
- [ ] Confirmar visualmente cómo se ve el logo en pantalla (fondo blanco/transparente, tamaño)

---

## 🔴 Bloqueante — sin esto no se puede cobrar nada

- [ ] Confirmar el string real de "pagado" en `/v2/transactions` de QvaPay (falta que alguien más complete un pago de prueba, ya que el dueño de la cuenta no puede pagarse a sí mismo)
- [x] Cargar `QVAPAY_APP_ID` / `QVAPAY_APP_SECRET` en las variables de entorno de **Render** (confirmado)
- [ ] Confirmar `FRONTEND_URL` y `API_URL` en Render apuntando a las URLs reales de producción (Vercel/Render), no a `localhost` — si no, el CORS bloquea pedidos reales

---

## 🟡 Importante — probar antes de anunciar la plataforma

- [ ] Correr `npm test` en el backend
- [ ] Probar el flujo completo de reserva de alojamiento de punta a punta (buscar → reservar → pagar con QvaPay → webhook aprueba → admin aprueba → contacto con host)
- [ ] Probar el flujo completo de excursiones (organizador crea → admin aprueba → turista reserva → admin aprueba)
- [ ] Confirmar que existe un usuario admin real en la base de producción
- [ ] **Monitoreo de errores en producción** (ej. Sentry o similar) — hoy no hay nada; los errores del backend solo se ven en los logs de Render

---

## 🟢 Contenido — sin esto la plataforma está vacía

- [ ] Al menos un host con una propiedad publicada y aprobada
- [ ] Si se lanza con excursiones también: al menos un organizador aprobado con una excursión activa

---

## Notas

- El monitoreo de errores es nuevo en esta lista (agregado a pedido, agosto 2026) — todavía no se evaluó qué herramienta usar ni se implementó nada.
- Este checklist se actualiza a medida que se van resolviendo puntos — marcar con `[x]` lo que se confirme.
