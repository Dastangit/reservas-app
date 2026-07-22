# Especificación Técnica — Disponibilidad, Notificaciones y Fee Mensual

**Proyecto:** Da-El World Travelers
**Versión:** 1.0
**Estado:** Lista para implementación
**Complementa a:** 04-PLAN-DISPONIBILIDAD-Y-FEE-MENSUAL.md

> Nota: esta spec asume que NO se modifican archivos existentes hasta que se apruebe la implementación. Marca con ✏️ los archivos existentes que requieren edición y con 🆕 los archivos nuevos.

---

## 0. Instrucciones para la IA que implemente este código

Este documento es la fuente de verdad para implementar. Antes de escribir código, ten en cuenta lo siguiente, verificado directamente contra el código actual del repo (no es una suposición):

1. **No reutilices la ruta `GET /properties/:id/availability` existente** (función `checkAvailability` en `propertyController.js`). Se confirmó que ningún archivo del frontend la consume actualmente — está huérfana. Por eso, para el calendario visual se crea una ruta **nueva y separada**: `GET /properties/:id/availability/calendar` (ver §2.1). No modifiques `checkAvailability` ni su ruta original; déjalas intactas.
2. **`bookingController.createBooking` no debe tocarse.** Lee `property.blocked_dates` directamente (no llama a ningún endpoint) para validar choques de fecha. Como los cambios al subdocumento `blocked_dates` son solo campos agregados (`blocked_by`, `blocked_by_user`, `created_at`), esa lógica sigue funcionando sin cambios.
3. **Único archivo existente con lógica de negocio que SÍ debe editarse:** `backend/controllers/propertyController.js`, función `getProperties`. Hay que agregar `suspended: { $ne: true }` (o `suspended: false`) al `query` inicial, junto a `status: 'active'`, para que una propiedad suspendida por incumplimiento de fee no aparezca en resultados de búsqueda pública. Es un agregado de una línea, no quita ningún filtro existente.
4. **`host_fee_amount` y campos relacionados en `Booking.js` son legacy.** Se confirmó que ninguna vista actual (`hostEarnings.js`, `adminBookings.js`, `BookingCard.js`) los muestra — todas usan `total_amount`/`fee_amount` (el fee del turista, no el del host). Es seguro dejarlos deprecated sin migración de datos.
5. **No elimines ni renombres ningún campo o endpoint existente.** Todos los cambios de este plan son aditivos (nuevos archivos, nuevos campos, nuevas rutas), con la única excepción del filtro de búsqueda del punto 3.
6. Sigue el **orden de implementación de §6** — cada fase es desplegable de forma independiente y no depende de que las fases posteriores existan.
7. Usa el estilo de código ya existente en el repo (Express + controladores separados de rutas, Mongoose sin TypeScript, `async/await` con `try/catch` y `next(error)`, respuestas siempre `{ success, data }` o `{ success:false, error }`).

---

## 1. Modelos (Mongoose)

### 1.1 ✏️ `backend/models/Property.js`

Modificar el subdocumento `blocked_dates`:

```js
blocked_dates: [{
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  reason: String,
  blocked_by: {
    type: String,
    enum: ['host', 'admin'],
    required: true,
    default: 'host',
  },
  blocked_by_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  created_at: { type: Date, default: Date.now },
}],
```

Agregar campos de suspensión por incumplimiento de fee:

```js
suspended: {
  type: Boolean,
  default: false,
},
suspension_reason: String,
suspended_at: Date,
```

`status` ya tiene `'inactive'`; usar el campo `suspended` como flag independiente (no reemplaza `status`) para poder reactivar sin perder el estado de aprobación original.

Actualizar índice de búsqueda para excluir suspendidas:
```js
propertySchema.index({ tenant_id: 1, status: 1, suspended: 1, 'location.city': 1 });
```

### 1.2 ✏️ `backend/models/User.js`

Agregar `'suspended'` al enum de `host_status`:

```js
host_status: {
  type: String,
  enum: ['pending', 'approved', 'rejected', 'suspended'],
  default: 'pending',
},
host_suspended_at: Date,
```

### 1.3 🆕 `backend/models/HostSettlement.js`

```js
const mongoose = require('mongoose');

const hostSettlementSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  host_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  period: {
    type: String, // formato 'YYYY-MM'
    required: true,
  },
  total_bookings_amount: {
    type: Number,
    required: true,
    default: 0,
  },
  fee_percentage: {
    type: Number,
    default: 10,
  },
  amount_due: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  booking_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  }],
  payment_method: {
    type: String,
    enum: ['nowpayments', 'manual'],
  },
  proof_url: String,
  status: {
    type: String,
    enum: ['pending', 'notice_sent', 'suspended', 'paid'],
    default: 'pending',
  },
  notice_sent_at: Date,
  suspended_at: Date,
  paid_at: Date,
  confirmed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

hostSettlementSchema.index({ tenant_id: 1, host_id: 1, period: 1 }, { unique: true });
hostSettlementSchema.index({ tenant_id: 1, status: 1 });

module.exports = mongoose.model('HostSettlement', hostSettlementSchema);
```

### 1.4 ✏️ `backend/models/Booking.js`

`host_fee_amount` / `host_fee_status` / `host_fee_paid_*` quedan **deprecated** (no se borran, por compatibilidad con reservas históricas ya facturadas con el modelo flat). Nuevas reservas no usan estos campos; el fee se calcula agregado en `HostSettlement`.

Agregar comentario en el schema:
```js
// DEPRECATED desde v2.2: el fee de host ahora se calcula mensualmente
// en el modelo HostSettlement (10% agregado), no por reserva individual.
host_fee_amount: { type: Number, default: 3 },
```

---

## 2. Endpoints

### 2.1 Disponibilidad — Host

| Método | Ruta | Auth | Body | Respuesta 200/201 | Errores |
|---|---|---|---|---|---|
| `POST` | `/api/properties/:id/availability/block` | host (propietario) | `{ start_date, end_date, reason }` | `{ success:true, data:{ block } }` | `404` propiedad no encontrada / no es tuya · `409 DATE_CONFLICT` choca con booking activo (incluye `conflicting_booking_id`) |
| `DELETE` | `/api/properties/:id/availability/block/:blockId` | host (propietario) | — | `{ success:true }` | `404` bloqueo no encontrado |
| `GET` | `/api/properties/:id/availability/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` | público | — | `{ success:true, data:{ blocked_dates, bookings:[{check_in,check_out}] } }` | `404` |

> ⚠️ Esta es una ruta **nueva**, distinta de `GET /api/properties/:id/availability` (que ya existe con `checkAvailability` y usa `check_in`/`check_out`). No se toca la ruta original — ver §0.1.

Controlador `POST .../block` (pseudocódigo):
```js
exports.blockDates = async (req, res, next) => {
  const property = await Property.findOne({ _id: req.params.id, tenant_id: req.tenantId, host_id: req.user._id });
  if (!property) return res.status(404).json({ success:false, error:'Property not found' });

  const { start_date, end_date, reason } = req.body;

  const conflict = await Booking.findOne({
    property_id: property._id,
    status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
    check_in: { $lt: end_date },
    check_out: { $gt: start_date },
  });
  if (conflict) {
    return res.status(409).json({ success:false, error:'DATE_CONFLICT', conflicting_booking_id: conflict._id });
  }

  const block = { start_date, end_date, reason, blocked_by:'host', blocked_by_user:req.user._id };
  property.blocked_dates.push(block);
  await property.save();

  res.status(201).json({ success:true, data:{ block: property.blocked_dates.at(-1) } });
};
```

### 2.2 Disponibilidad — Admin

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| `POST` | `/api/admin/properties/:id/availability/block` | admin | mismo body/lógica, `blocked_by:'admin'`, sin restricción de `host_id` propio |
| `DELETE` | `/api/admin/properties/:id/availability/block/:blockId` | admin | — |
| `GET` | `/api/admin/properties/:id/availability/calendar?from&to` | admin | mismo shape que la versión host, sin filtro de `host_id` propio |
| `GET` | `/api/admin/properties?tenant_id` | admin | lista de propiedades para poblar el dropdown del panel |

### 2.2.1 ✏️ Ajuste obligatorio en `propertyController.getProperties`

Agregar al objeto `query` inicial (junto a `status: 'active'`):
```js
const query = { tenant_id: req.tenantId, status: 'active', suspended: { $ne: true } };
```
Esto excluye de la búsqueda pública cualquier propiedad suspendida por incumplimiento de fee (Parte D). Es la única edición de lógica de negocio sobre un archivo existente en todo este plan.

### 2.3 Notificación de reserva aprobada

| Método | Ruta | Auth | Comportamiento |
|---|---|---|---|
| — (hook interno) | dentro de `bookingController.approveBooking` | admin | tras `status='approved'`, llama `sendHostBookingNotification(host, booking, property)` (email) |
| `GET` | `/api/admin/bookings/:id/whatsapp-link` | admin | devuelve `{ url: 'https://wa.me/<phone>?text=<encoded_message>' }` para el botón manual |

### 2.4 Fee mensual y liquidaciones

| Método | Ruta | Auth | Body | Notas |
|---|---|---|---|---|
| `GET` | `/api/admin/settlements?period=YYYY-MM` | admin | — | lista todos los `HostSettlement` del periodo (se generan por cron, ver §3) |
| `GET` | `/api/admin/settlements/:id` | admin | — | detalle + bookings incluidos |
| `POST` | `/api/admin/settlements/:id/confirm-payment` | admin | `{ payment_method:'manual', proof_url }` (`proof_url` obligatorio si `manual`) | marca `status:'paid'`, `paid_at`, `confirmed_by` |
| `GET` | `/api/admin/settlements/:id/whatsapp-link` | admin | — | link `wa.me` pre-llenado para aviso/suspensión |
| `DELETE` | `/api/admin/hosts/:id` | admin | `{ confirm: true }` | **solo permitido si** existe un `HostSettlement` en `status:'suspended'` con `suspended_at` ≥ 15 días. Si no se cumple, `403 NOT_ELIGIBLE_FOR_DELETION` |

Validación de elegibilidad para eliminar (pseudocódigo):
```js
exports.deleteHost = async (req, res, next) => {
  const settlement = await HostSettlement.findOne({
    host_id: req.params.id,
    status: 'suspended',
    suspended_at: { $lte: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
  });
  if (!settlement) {
    return res.status(403).json({ success:false, error:'NOT_ELIGIBLE_FOR_DELETION' });
  }
  // soft-delete recomendado: status='suspended' permanente + host_status='suspended'
  // en vez de borrado físico, para mantener trazabilidad/auditoría legal.
  ...
};
```
> **Recomendación de implementación:** usar borrado lógico (soft-delete: `status:'inactive'`, `host_status:'suspended'`, ocultar de todas las queries públicas) en vez de `deleteOne` físico. Mantiene el historial de reservas pasadas íntegro (necesario para reportes y para el propio `HostSettlement`) y permite reversión manual si hubo un error.

---

## 3. Cron Jobs (`backend/jobs/`)

### 3.1 🆕 `generateMonthlySettlements.js`
- **Frecuencia:** día 1 de cada mes, 00:10 UTC.
- **Lógica:** por cada host con `role:'host'` y `host_status:'approved'`, agrupa `Booking` del mes anterior con `status` en `['approved','completed']`, suma `total_amount`, calcula `amount_due = total * 0.10`. Crea `HostSettlement` con `status:'pending'`. Si `amount_due === 0`, no crea registro (nada que cobrar).

### 3.2 🆕 `settlementReminders.js`
- **Frecuencia:** diaria, 09:00 (hora tenant).
- **Lógica:** busca `HostSettlement` con `status:'pending'` y `period` cuyo fin de mes fue hace ≥3 días. Envía email automático (`sendSettlementNotice`), marca `notice_sent_at`, cambia `status:'notice_sent'`.

### 3.3 🆕 `settlementSuspension.js`
- **Frecuencia:** diaria, 09:15 (hora tenant).
- **Lógica:** busca `HostSettlement` con `status:'notice_sent'` y `notice_sent_at` hace ≥3 días. Marca `status:'suspended'`, `suspended_at:now`. Actualiza todas las `Property` del host: `suspended:true`, `suspension_reason:'unpaid_fee'`. Envía email automático de suspensión (link wa.me se genera on-demand desde el panel, no se envía solo).
- **No incluye ninguna acción de borrado** — la eliminación es siempre manual vía `DELETE /api/admin/hosts/:id`.

Registrar los tres jobs en `server.js` o en el runner de cron existente (revisar cómo está registrado el cron de `hold_expires_at` actual, para seguir el mismo patrón).

---

## 4. Utilidades de email (`backend/utils/email.js`)

Agregar funciones nuevas (no modificar las existentes):

```js
const sendHostBookingNotification = async (host, booking, property) => { ... };
const sendSettlementNotice = async (host, settlement) => { ... };
const sendSettlementSuspension = async (host, settlement) => { ... };
```

Y exportarlas junto a las existentes.

### Utilidad nueva `backend/utils/whatsapp.js` 🆕
```js
const buildWhatsAppLink = (phone, message) => {
  const cleanPhone = phone.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};
module.exports = { buildWhatsAppLink };
```
Se usa tanto para notificación de reserva aprobada como para avisos/suspensión de fee — mismo patrón en los tres casos, sin costo de API externa.

---

## 5. Frontend

### 5.1 🆕 `frontend/js/components/AvailabilityCalendar.js`

Componente reutilizable, API propuesta:

```js
// Uso:
AvailabilityCalendar.render({
  propertyId: 'xxx',
  mode: 'host' | 'admin',   // determina qué endpoints usa (/properties/... vs /admin/properties/...)
  container: '#calendar-root',
});
```

Responsabilidades:
- Fetch de `GET .../availability/calendar?from=...&to=...` (blocked_dates + bookings) para el rango mes actual → mes actual+1. En `mode:'admin'` usa `/api/admin/properties/:id/availability/calendar` (mismo shape de respuesta, ver §2.2).
- Render de grid mensual con estados visuales (libre/host/admin/reservado).
- Manejo de selección de 2 clics → abre modal de confirmación → on-confirm llama `POST .../block`.
- Manejo de click en `×` sobre bloqueo existente → `DELETE .../block/:blockId`.
- Muestra error inline (no `alert()`) si `409 DATE_CONFLICT`.

### 5.2 ✏️ `frontend/js/pages/calendarAvailability.js`
Reescribir para usar `AvailabilityCalendar` en `mode:'host'`, eliminando el formulario plano actual.

### 5.3 🆕 `frontend/js/pages/adminAvailability.js`
- Dropdown de propiedades (fetch `GET /api/admin/properties`).
- Al seleccionar, monta `AvailabilityCalendar` en `mode:'admin'` apuntando a la propiedad elegida.

### 5.4 🆕 `frontend/js/pages/adminSettlements.js`
- Tabla de `HostSettlement` del periodo seleccionado: host, monto adeudado, estado, días de atraso.
- Botón "Confirmar pago" → modal con selector de método + input de `proof_url` (upload a Cloudinary, ya integrado en `utils/cloudinary.js`) si es manual.
- Botón "Generar link WhatsApp" (aviso o suspensión, según estado) → abre `wa.me` en nueva pestaña.
- Botón "Eliminar host" → **solo habilitado** si el backend confirma elegibilidad (`suspended_at` ≥ 15 días); si no, se muestra deshabilitado con tooltip explicando cuántos días faltan.

### 5.5 ✏️ `frontend/js/pages/hostDashboard.js`
Agregar banner de estado si el host tiene un `HostSettlement` en `status` distinto de `paid`/inexistente (ej. "Tienes un pago de fee pendiente — revisa tu correo").

---

## 6. Orden de implementación sugerido

1. Modelos (`Property`, `User`, `HostSettlement`) + migraciones si aplica.
2. Endpoints de disponibilidad (host + admin) — más simple, sin dependencias externas.
3. `AvailabilityCalendar.js` + páginas host/admin de disponibilidad.
4. Notificación de reserva aprobada (email + wa.me) — depende de `utils/whatsapp.js`.
5. `HostSettlement` + cron de generación mensual.
6. Crons de aviso/suspensión + página `adminSettlements.js`.
7. Endpoint de eliminación manual + validación de elegibilidad.

Cada punto es independiente y desplegable por separado — no requiere que todo el plan esté terminado para poner en producción, por ejemplo, solo la Parte A (calendario).
