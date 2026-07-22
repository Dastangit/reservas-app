# Plan de Modificaciones — Disponibilidad, Notificaciones y Fee Mensual

**Proyecto:** Da-El World Travelers
**Fecha:** Julio 2026
**Estado:** Aprobado — pendiente de implementación
**Relacionado con:** 01-ESPECIFICACION-TECNICA-COMPLETA.md, 02-SPEC-PARA-IA.json

---

## Contexto

Este plan cubre modificaciones sobre la implementación ya existente, sin romper lo que funciona hoy:
- `Property.blocked_dates[]` ya existe en el modelo.
- `PUT /properties/:id/availability` (reemplazo total del array) y `GET /properties/:id/availability` (chequeo de choque) ya existen.
- `calendarAvailability.js` existe como formulario básico, sin representación visual de calendario.
- El fee actual de anfitrión es flat ($3 USD por reserva, `Booking.host_fee_amount`). Este plan lo reemplaza por un modelo porcentual mensual.
- No existe notificación al anfitrión en ningún punto del flujo actual (`utils/email.js` solo notifica al turista).

---

## Parte A — Disponibilidad y Calendario Visual

### A.1 Bloqueo manual rápido (Anfitrión)
Reemplaza el `PUT` que sobreescribe todo el array por operaciones aditivas/puntuales, evitando condiciones de carrera:
- Agregar un rango bloqueado con un clic.
- Eliminar un rango bloqueado puntual con un clic (botón `×`).
- Si el rango elegido choca con una reserva activa de la plataforma → **se bloquea la acción con error**, no se permite.

### A.2 Panel visual del Anfitrión (tipo calendario)
- Grid mensual, ventana fija: **mes actual + 1 mes** (sin navegación libre).
- Selección de rango: **2 clics** (día inicio → día fin).
- Colores/estados: libre / bloqueado por host / bloqueado por admin / reservado (booking real, solo informativo, no editable).
- **Modal de confirmación** antes de aplicar cualquier bloqueo ("¿Confirmas bloquear del 10 al 15?").
- Reemplaza `calendarAvailability.js` actual.

### A.3 Panel global del Admin
- Mismo componente de calendario que el del host.
- Navegación entre propiedades vía **dropdown/selector desplegable**.
- El admin **puede editar/bloquear en nombre del anfitrión** (no es solo lectura).
- Nueva página `adminAvailability.js`.

### A.4 Ventana de reservas (decisión de negocio)
- **Sin límite de anticipación.** Se descarta la idea original de limitar reservas a 1 mes, porque el mercado objetivo (turistas canadienses en temporada alta nov-abr) reserva típicamente con 2-6 meses de anticipación. El conflicto de doble reserva ya se resuelve con el sistema de bloqueo manual (A.1-A.3), no restringiendo la ventana de reserva.

---

## Parte B — Notificación al Anfitrión (reserva por plataforma)

- Se dispara **al aprobar** la reserva (no al crearla), momento en que las fechas quedan confirmadas.
- Canal doble, costo $0/mes:
  1. **Email automático** (SendGrid) con detalles de la reserva.
  2. **Link `wa.me` pre-llenado**, generado por el sistema, que el **admin envía manualmente con 1 clic** desde el panel — evita el costo de una API de WhatsApp Business (Twilio).

---

## Parte C — Fee Mensual del 10%

- Se reemplaza el fee flat de $3/reserva por **10% sobre el total de reservas completadas a través de la plataforma** en el mes calendario.
- El 10% se calcula **solo sobre reservas nacidas en la plataforma** (dato verificable en `Booking.total_amount`). No se cobra porcentaje sobre reservas que el anfitrión consiga por fuera — no es verificable ni auditable, y forzarlo generaría desconfianza sin beneficio real.
- Pago del fee:
  - **Vía NOWPayments** dentro de la plataforma (automatizable), o
  - **Manual/personal** (acuerdo directo admin-host) — en este caso, la confirmación del admin **requiere adjuntar un comprobante** (captura/foto de pago), no un simple toggle sin respaldo.

---

## Parte D — Cumplimiento Escalonado (reemplaza eliminación automática inmediata)

Se descarta la eliminación automática e inmediata por incumplimiento (desproporcionado, sin apelación, riesgo reputacional en mercado temprano). En su lugar, sistema escalonado:

| Momento | Acción | Tipo |
|---|---|---|
| Fin de mes + 3 días | Envío de **aviso** de pago pendiente | Email automático + wa.me manual (mismo patrón de Parte B) |
| Aviso + 3 días sin pago | **Suspensión temporal**: propiedad oculta de búsquedas, no recibe nuevas reservas | Automático (sistema) + notificación email/wa.me |
| 15 días en suspensión | Admin puede **eliminar definitivamente** host + propiedad | **Siempre manual**, requiere confirmación explícita del admin — nunca ocurre solo |

La suspensión es reversible en cualquier momento si el host paga. La eliminación no.

---

## Resumen de decisiones de negocio (por qué se ajustó el plan original)

| Idea original del cliente | Ajuste aplicado | Razón |
|---|---|---|
| 10% sobre TODAS las ganancias (dentro y fuera de plataforma) | 10% solo sobre reservas de la plataforma | Lo de fuera no es verificable; forzarlo genera desconfianza sin poder auditarlo |
| Botón simple "pagó/no pagó" | Igual, pero con comprobante obligatorio adjunto | Cubre legalmente al admin y da trazabilidad ante disputas |
| Eliminación automática inmediata por incumplimiento | Aviso → suspensión temporal → eliminación manual (escalonado) | Evita perder anfitriones valiosos por errores administrativos en un mercado donde cada host cuesta conseguir |
| Reservas limitadas a máximo 1 mes de anticipación | Sin límite de anticipación | El mercado objetivo (turistas canadienses) reserva con meses de anticipación; limitarlo sacrifica el negocio principal. El conflicto de doble reserva ya lo resuelve el calendario de bloqueo |

---

## Siguiente paso
Ver `05-SPEC-TECNICA-DISPONIBILIDAD-Y-FEE.md` para el detalle técnico de implementación (modelos, endpoints, cron jobs, componentes frontend).

---

## Parte E — Decisión final: Fee de prerreserva del turista ($10 → $5)

Se evaluaron dos propuestas alternativas al modelo de fee actual:
1. Eliminar el fee del turista por completo, cobrando solo el % mensual al host.
2. Cobrar el 100% del monto de la reserva al turista vía la plataforma (modelo Airbnb/Booking).

**Decisión:** ninguna de las dos se adopta. Se descartaron por:
- **Opción 1:** elimina el único mecanismo de compromiso real del turista con la reserva (hoy reduce reservas especulativas/fantasma) y traslada el 100% del riesgo de cobro a la confianza post-hecho del host, en vez de asegurar una fracción de ingreso de inmediato.
- **Opción 2:** se verificó contra la documentación real de NOWPayments y MoonPay que no existe un mecanismo limpio para reembolsar a un turista que pagó con tarjeta el monto completo de una reserva. NOWPayments es no-custodial (el reembolso debe salir manualmente de la wallet del admin) y el off-ramp de MoonPay liquida a la cuenta de quien ejecuta la venta (el admin), no directamente de vuelta a la tarjeta original del turista. Cobrar el 100% multiplicaría la exposición a disputas de reembolso sin un camino confiable de resolución.

**Cambio aprobado:** se mantiene el modelo actual (depósito fijo no reembolsable vía cripto/NOWPayments, resto pagado en el alojamiento), mismo mecanismo de compromiso, misma arquitectura de pagos — solo se **reduce el monto de $10 a $5 USD** para bajar la fricción de la primera experiencia cripto sin eliminar el mecanismo de compromiso ni asumir el riesgo de reembolso del 100%.

### Impacto técnico verificado (para la IA que implemente)

El valor $10 está duplicado en más lugares de los que parece a simple vista — no es solo un número de configuración:

**✏️ Backend:**
- `backend/models/Tenant.js` → `settings.payment.fee_amount` (default `10` → `5`)
- `backend/models/Booking.js` → `fee_amount` (default `10` → `5`)

**✏️ Frontend — configuración:**
- `frontend/js/config.js` → `fee.amount: 10 → 5` y `fee.display: '$10 USD' → '$5 USD'`

**✏️ Frontend — traducciones (i18n) — el punto que más fácil se pasa por alto:**
El texto "$10 USD" está escrito literalmente dentro de los strings de traducción, no se genera dinámicamente desde `config.js`. Confirmado en `frontend/locales/es.json` en las siguientes claves (y sus equivalentes en `en.json` y `fr.json`, que deben revisarse una por una ya que el proyecto mantiene paridad de claves entre los 3 idiomas):
- `howItWorks.step2.description`
- `booking.feeNote`
- `booking.confirm`
- `pages.howItWorks.touristStep2Desc`
- `pages.howItWorks.bookingFeeDesc`
- `pages.howItWorks.cancellationDesc`
- `pages.terms.s5Fee`
- `pages.terms.s6Flat`
- `pages.terms.s7Fee`
- `pages.faq.q1Step2`
- `pages.faq.q2Answer`
- `pages.faq.q3Answer`
- `pages.faq.q4Question`
- `pages.faq.q5NoFee`

**Instrucción para la IA:** buscar el string literal `$10` en los tres archivos `frontend/locales/*.json` y reemplazar cada ocurrencia por `$5`, verificando que el reemplazo tenga sentido gramatical en cada idioma (no es un simple find-replace ciego, hay que confirmar cada string en su idioma). No modificar ninguna otra clave de estos archivos.
