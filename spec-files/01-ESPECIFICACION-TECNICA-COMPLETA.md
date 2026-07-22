# ESPECIFICACIÓN TÉCNICA COMPLETA
## App Multi-Tenant de Reservas Turísticas

**Versión:** 2.0  
**Fecha:** Julio 2026  
**Estado:** Especificación Actualizada — En Desarrollo  
**Autor:** Dats (Emprendedor/Developer)

---

## TABLA DE CONTENIDOS

1. [Visión General](#1-visión-general)
2. [Arquitectura](#2-arquitectura)
3. [Funcionalidades Core](#3-funcionalidades-core)
4. [Sistema de Pagos](#4-sistema-de-pagos)
5. [Modelos de Datos](#5-modelos-de-datos)
6. [Endpoints API REST](#6-endpoints-api-rest)
7. [Flujo UX - Wireflows](#7-flujo-ux---wireflows)
8. [Seguridad](#8-seguridad)
9. [Módulos Futuros](#9-módulos-futuros)
   - 9.1 [Módulo: Excursiones y Experiencias Grupales](#91-módulo-excursiones-y-experiencias-grupales)
   - 9.2 [Módulo: Community - Muro de Viajes](#92-módulo-community---muro-de-viajes)
   - 9.3 [Módulo: Temas y Diseño Editable](#93-módulo-temas-y-diseño-editable)
10. [Roadmap](#10-roadmap)

---

## 1. VISIÓN GENERAL

### 1.1 Propósito
Plataforma de turismo completa diseñada para Cuba, escalable a múltiples países mediante arquitectura multi-tenant SaaS. El núcleo es un sistema de reservas de alojamientos (tipo Booking/Airbnb), expandible con módulos de experiencias grupales, comunidad de viajeros y monetización de contenido.

### 1.2 Tipo de Proyecto
- **Modelo:** SaaS Multi-Tenant
- **Mercado inicial:** Cuba → turismo canadiense
- **Modelo de negocio:** Comisión por reserva + suscripción de tenants (versión B2B)
- **Expansión futura:** Fee por excursiones grupales + publicidad en Community + monetización de bloggers

### 1.3 Stack Tecnológico
```
Frontend:        HTML5 + CSS3 + JavaScript (vanilla)
PWA:             Service Worker + Web App Manifest
Idiomas:         i18n (English, Français, Español)
Backend:         Node.js + Express.js
Base de Datos:   MongoDB
Pagos:           NOWPayments + MoonPay (gateway a confirmar)
Autenticación:   JWT
Hosting:         Railway.app o Fly.io (backend) + Vercel (frontend)

--- Módulos Futuros (Fase 5+) ---
Imágenes/Video:  Cloudinary (para Community module)
Chat en tiempo real: Socket.io (para grupos de excursiones)
```

---

## 2. ARQUITECTURA

### 2.1 Estructura Multi-Tenant

Cada "administrador" (tenant) tiene su propia instancia lógica:

```
┌─────────────────────────────────────────────┐
│         PLATAFORMA COMPARTIDA               │
├─────────────────────────────────────────────┤
│  Database MongoDB (compartida, filtrada)    │
├───────────────┬───────────────┬─────────────┤
│  Tenant 1     │  Tenant 2     │  Tenant 3   │
│  (Cuba)       │  (México)     │  (Costa Rica)│
│  cuba.app.com │ mexico.app.com│cr.app.com   │
└───────────────┴───────────────┴─────────────┘
```

**Principio:** Cada tabla en MongoDB incluye `tenant_id` que agrupa datos automáticamente.

### 2.2 Componentes Principales

```
┌──────────────────────────────────────────────────────┐
│                   FRONTEND (PWA)                      │
│  Landing → Search → Property → Booking → Payment     │
└────────────────────┬─────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────────┐    ┌──────▼──────────┐
│   API REST Node.js │    │   NOWPayments   │
│   + Express        │    │   (Cripto)      │
└───────┬────────────┘    └─────────────────┘
        │
┌───────▼────────────────────────────────┐
│        MongoDB (Multi-Tenant)          │
│  tenants, users, properties, bookings  │
│  reviews, feedback, payments           │
└────────────────────────────────────────┘
```

---

## 3. FUNCIONALIDADES CORE

### 3.1 Roles de Usuario

| Rol | Capacidades | Acceso |
|-----|-----------|--------|
| **Turista** | Buscar, filtrar, reservar, pagar, reseñar, feedback | Público (con datos limitados) |
| **Anfitrión** | Publicar propiedades (requiere aprobación), gestionar calendario, ver reservas | Privado |
| **Admin** | Aprobar propiedades, aprobar reservas, responder feedback, configuración | Privado (solo tenant) |

### 3.2 Tipos de Alojamiento
- **Casa particular:** 1 unidad, N huéspedes máximo
- **Hostel:** Múltiples camas/habitaciones, gestión compleja de ocupación

### 3.3 Sistema de Reservas

**Tipo:** Instantáneo con aprobación posterior

```
Turista selecciona → Paga $10 USD → Hold 3h → 
Admin aprueba → Turista recibe confirmación → 
Paga resto en alojamiento
```

**Opciones de pago en alojamiento:**
- Pago completo (todo al llegar)
- Pago diario (flexible, cancela sin pedir reembolso)

### 3.4 Búsqueda y Filtros

**Básicos:** Ubicación + Fechas + Número de huéspedes

**Intermedios:** + Rango de precio + Tipo propiedad

**Avanzados:** + Amenidades + Valoración mínima + Ordenar por (precio/popularidad)

### 3.5 Sistema de Reseñas

**Modelo:** Ciego (Airbnb-style)

1. Turista completa estancia
2. Turista escribe reseña sin ver la del anfitrión
3. Anfitrión escribe reseña sin ver la del turista
4. Se revelan simultáneamente

**Valoración:** Promedio automático de estrellas = rating de propiedad

### 3.6 Sistema de Feedback

- Visible solo para admin
- Turistas pueden dejar ideas después de completar estancia
- Admin puede responder de forma privada
- No es público

---

## 4. SISTEMA DE PAGOS

### 4.1 Gateway Principal: NOWPayments

**Configuración:**
- Cripto: USDT (TRC-20 recomendado)
- Alternativas: BTC, ETH
- Conversión tarjeta→cripto: MoonPay (integrado en NOWPayments)

### 4.2 Fee de Prerreserva
- **Monto:** $10 USD (FIJO)
- **Reembolsable:** NO
- **Cuando se cobra:** Al hacer click en "Pagar reserva"
- **Cripto:** USDT (TRC-20 preferido)

### 4.3 Hold Temporal
- **Duración:** 3 horas
- **Comportamiento:**
  - Fecha de creación: Sistema crea hold
  - Si pago confirma: Hold se convierte en reserva "pending_approval"
  - Si pago no confirma: Hold expira automáticamente, fechas libres
  - Admin aprueba: Reservation "approved"

### 4.4 Flujo Técnico Cripto

```
1. Turista envía formulario de reserva
2. Backend genera invoice en NOWPayments API
3. Widget NOWPayments abre (cripto o MoonPay/tarjeta)
4. Turista completa pago
5. Blockchain confirma (1-3 min)
6. Webhook de NOWPayments → Backend actualiza status
7. Admin recibe notificación
8. Admin aprueba → Turista recibe email confirmación
```

### 4.5 Liquidación a Admin
- Fondos llegan a wallet cripto del admin (USDT-TRC20)
- Admin convierte a fiat/CUP según necesidad (vía Binance P2P, exchange local, etc.)
- NOWPayments no custodia fondos (redirige automáticamente a wallet del admin)

---

## 5. MODELOS DE DATOS

### 5.1 Colección: Tenants

```javascript
{
  _id: ObjectId,
  name: "Cuba Tourism",
  domain: "cuba.reservas.app",
  admin_email: "admin@cuba.com",
  admin_phone: "+53 123 456 789",
  admin_whatsapp: "+53 123 456 789",
  api_key: "sk_live_...",
  
  settings: {
    languages: ["es", "en", "fr"],
    default_language: "es",
    currency: "USD",
    timezone: "America/Havana",
    
    payment: {
      gateway: "nowpayments",
      nowpayments_api_key: "...",
      nowpayments_ipn_key: "...",
      moonpay_enabled: true,
      fee_amount: 10,
      fee_currency: "USD"
    },
    
    branding: {
      logo_url: "...",
      primary_color: "#...",
      secondary_color: "#...",
      favicon_url: "..."
    }
  },
  
  status: "active", // active, inactive, suspended
  subscription_tier: "pro", // starter, pro, enterprise
  created_at: ISODate("2026-07-03"),
  updated_at: ISODate("2026-07-03")
}
```

### 5.2 Colección: Users

```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,
  email: "tourist@example.com",
  phone: "+1 555 1234",
  phone_whatsapp: true,
  name: "John Doe",
  role: "tourist", // tourist, host, admin
  
  profile: {
    avatar_url: "...",
    bio: "...",
    verified: false,
    verification_date: null
  },
  
  password_hash: "...",
  password_salt: "...",
  
  auth: {
    last_login: ISODate("2026-07-03"),
    login_count: 5,
    ip_addresses: ["..."]
  },
  
  status: "active", // active, inactive, suspended
  created_at: ISODate("2026-07-03"),
  updated_at: ISODate("2026-07-03")
}
```

### 5.3 Colección: Properties

```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,
  host_id: ObjectId,
  
  // Información básica
  name: "Casa Azul Habana",
  type: "casa_particular", // casa_particular, hostel
  description: "...",
  
  // Ubicación
  location: {
    city: "Habana",
    neighborhood: "Vedado",
    address: "Calle 23 e/ 10 y 12",
    latitude: 23.1291,
    longitude: -82.3794
  },
  
  // Detalles de alojamiento
  max_guests: 4,
  bedrooms: 2,
  bathrooms: 1,
  bed_types: ["double", "single"],
  
  // Precios
  price_per_night: 50,
  currency: "USD",
  
  // Amenidades
  amenities: ["wifi", "air_conditioning", "kitchen", "pool"],
  
  // Imágenes
  images: [
    {
      url: "...",
      title: "Living room",
      order: 1,
      is_primary: true
    }
  ],
  
  // Disponibilidad
  blocked_dates: [
    {
      start_date: ISODate("2026-07-15"),
      end_date: ISODate("2026-07-20"),
      reason: "maintenance",
      blocked_by: "host", // host, admin — ver 05-SPEC-TECNICA
      blocked_by_user: ObjectId,
      created_at: ISODate("2026-07-10")
    }
  ],

  // Suspensión por incumplimiento de fee mensual (ver 04/05)
  suspended: false,
  suspension_reason: null,
  suspended_at: null,
  
  // Opciones de pago
  payment_options: ["full_payment", "daily_payment"],
  
  // Reseñas y rating
  rating: 4.5,
  reviews_count: 12,
  
  // Estado
  status: "active", // pending_approval, active, inactive, rejected
  approval_date: ISODate("2026-07-03"),
  rejection_reason: null,
  admin_notes: "...",
  
  created_at: ISODate("2026-07-01"),
  updated_at: ISODate("2026-07-03")
}
```

### 5.4 Colección: Bookings

```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,
  property_id: ObjectId,
  tourist_id: ObjectId,
  host_id: ObjectId,
  
  // Fechas
  check_in: ISODate("2026-07-15"),
  check_out: ISODate("2026-07-20"),
  num_nights: 5,
  num_guests: 2,
  
  // Pago del fee
  fee_amount: 10,
  fee_currency: "USD",
  fee_paid: true,
  fee_paid_at: ISODate("2026-07-03T10:30:00Z"),
  fee_transaction_id: "nowpay_abc123",
  
  // Monto total (sin contar fee)
  total_amount: 250,
  
  // Opción de pago en alojamiento
  payment_option: "daily_payment", // full_payment, daily_payment
  
  // Datos del turista recolectados
  tourist_data: {
    name: "John Doe",
    email: "john@example.com",
    phone: "+1 555 1234",
    contact_method: "whatsapp" // whatsapp, email
  },
  
  // Hold
  hold_expires_at: ISODate("2026-07-03T13:30:00Z"),
  
  // Estado
  status: "pending_approval", // pending_approval, approved, rejected, completed, cancelled
  status_history: [
    {
      status: "pending_approval",
      changed_at: ISODate("2026-07-03T10:30:00Z"),
      changed_by: "system"
    }
  ],
  
  // Aprobación
  approved_by: ObjectId, // admin_id
  approved_at: ISODate("2026-07-03T11:00:00Z"),
  rejection_reason: null,
  
  // Notas
  admin_notes: "...",
  host_notes: "...",
  
  created_at: ISODate("2026-07-03T10:30:00Z"),
  updated_at: ISODate("2026-07-03T11:00:00Z")
}
```

### 5.5 Colección: Reviews

```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,
  booking_id: ObjectId,
  property_id: ObjectId,
  reviewer_id: ObjectId,
  reviewer_role: "tourist", // tourist, host
  
  rating: 4, // 1-5
  text: "Wonderful experience, very clean...",
  
  // Sistema ciego
  submitted_at: ISODate("2026-07-25T14:30:00Z"),
  pair_review_id: ObjectId, // ref a la reseña del otro lado
  both_submitted: true,
  revealed_at: ISODate("2026-07-25T14:45:00Z"),
  
  status: "visible", // draft, submitted, visible, hidden
  
  created_at: ISODate("2026-07-25T14:30:00Z"),
  updated_at: ISODate("2026-07-25T14:45:00Z")
}
```

### 5.6 Colección: Feedback

```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,
  user_id: ObjectId,
  booking_id: ObjectId,
  
  message: "The payment process could be simpler...",
  category: "ux", // ux, payment, communication, features, other
  
  admin_response: null,
  admin_response_by: null,
  admin_response_at: null,
  
  status: "new", // new, read, responded, archived
  
  created_at: ISODate("2026-07-25T20:00:00Z"),
  updated_at: ISODate("2026-07-25T20:00:00Z")
}
```

---

## 6. ENDPOINTS API REST

### 6.1 Autenticación (Public)

```
POST /api/auth/register
  Body: { email, password, name, phone?, role }
  Response: { user_id, token, tenant_id }

POST /api/auth/login
  Body: { email, password }
  Response: { user_id, token, role }

POST /api/auth/refresh
  Headers: { Authorization: Bearer token }
  Response: { token }

POST /api/auth/logout
  Headers: { Authorization: Bearer token }
  Response: { success: true }
```

### 6.2 Propiedades (Public para lectura, Private para escritura)

```
GET /api/properties
  Query: { city?, min_price?, max_price?, type?, amenities?, rating_min?, sort? }
  Response: { properties: [...], total_count, page, per_page }

GET /api/properties/:id
  Response: { property: {...}, reviews: [...], host: {...} }

POST /api/properties (Anfitrión)
  Auth: Bearer token
  Body: { name, type, description, location, max_guests, price_per_night, amenities, images, payment_options }
  Response: { property_id, status: "pending_approval" }

PUT /api/properties/:id (Anfitrión)
  Auth: Bearer token
  Body: { name?, description?, price_per_night?, amenities?, ... }
  Response: { property_id, updated_at }

PUT /api/properties/:id/availability (Anfitrión)
  Auth: Bearer token
  Body: { blocked_dates: [{ start_date, end_date, reason }] }
  Response: { property_id, blocked_dates }
```

### 6.3 Búsqueda y Filtros (Public)

```
GET /api/search
  Query: { check_in, check_out, num_guests, city?, min_price?, max_price?, type?, amenities?, rating_min?, sort_by?, page? }
  Response: { results: [...], total_count, filters_applied }

GET /api/properties/:id/availability
  Query: { check_in, check_out }
  Response: { available: boolean, blocked_dates: [...] }
```

### 6.4 Reservas (Private)

```
POST /api/bookings (Turista)
  Auth: Bearer token
  Body: {
    property_id,
    check_in,
    check_out,
    num_guests,
    payment_option, // full_payment, daily_payment
    tourist_data: { name, email, phone?, contact_method }
  }
  Response: { booking_id, invoice_url (NOWPayments), hold_expires_at }

GET /api/bookings (Turista)
  Auth: Bearer token
  Response: { bookings: [...], count }

GET /api/bookings/:id (Turista/Anfitrión/Admin)
  Auth: Bearer token
  Response: { booking: {...} }

PUT /api/bookings/:id/cancel (Turista)
  Auth: Bearer token
  Response: { booking_id, status: "cancelled" }

GET /api/bookings (Admin)
  Auth: Bearer token
  Query: { status?, property_id?, sort_by?, page? }
  Response: { bookings: [...], total_count }

POST /api/bookings/:id/approve (Admin)
  Auth: Bearer token
  Body: { notes?: "..." }
  Response: { booking_id, status: "approved", notifications_sent: true }

POST /api/bookings/:id/reject (Admin)
  Auth: Bearer token
  Body: { reason }
  Response: { booking_id, status: "rejected", refund_initiated: true }
```

### 6.5 Pagos (Webhooks)

```
POST /api/webhooks/nowpayments (Public - pero con verificación de signature)
  Body: { invoice_id, status, amount, txid, ... }
  Verifica: Signature de NOWPayments
  Response: { status: "received" }
  
  Acciones:
  - Si status == "confirmed" → Marca booking como "pending_approval"
  - Si status == "failed" → Libera hold de fechas
```

### 6.6 Reseñas (Private)

```
POST /api/reviews (Turista/Anfitrión)
  Auth: Bearer token
  Body: { booking_id, rating, text }
  Response: { review_id, status: "submitted" }
  
  Lógica: No show review_id del otro hasta que ambos hayan submitido

GET /api/reviews/property/:id (Public)
  Response: { reviews: [...], average_rating, total_count }
```

### 6.7 Feedback (Private)

```
POST /api/feedback (Turista - solo si tiene booking completado)
  Auth: Bearer token
  Body: { message, category?, booking_id }
  Response: { feedback_id, status: "new" }

GET /api/feedback (Admin)
  Auth: Bearer token
  Query: { status?, category?, sort_by?, page? }
  Response: { feedback: [...], total_count }

POST /api/feedback/:id/respond (Admin)
  Auth: Bearer token
  Body: { response }
  Response: { feedback_id, admin_response_at, email_sent: true }
```

### 6.8 Contacto (Public)

```
POST /api/contact
  Body: { name, email, message, property_id? }
  Response: { ticket_id, admin_email, admin_whatsapp }
  
  Envía email a admin con el mensaje
```

### 6.9 Administración (Admin Only)

```
GET /api/admin/dashboard
  Auth: Bearer token + admin role
  Response: { stats: { bookings_today, revenue, pending_approvals, feedback_new } }

GET /api/admin/properties/pending
  Auth: Bearer token + admin role
  Response: { properties: [...] }

POST /api/admin/properties/:id/approve
  Auth: Bearer token + admin role
  Response: { property_id, status: "active", email_sent: true }

POST /api/admin/tenants (Super-admin only)
  Body: { name, domain, admin_email, settings }
  Response: { tenant_id, api_key }

PUT /api/admin/settings
  Auth: Bearer token + admin role
  Body: { logo_url?, colors?, languages?, ... }
  Response: { tenant_id, settings }
```

---

## 7. FLUJO UX - WIREFLOWS

### 7.1 Flujo del Turista (Principal)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. LANDING PAGE                                             │
│   - Hero + Buscador principal                              │
│   - Explicación modelo de pago ($10 USD)                  │
│   - Propiedades destacadas                                 │
│   - Footer: correo + WhatsApp admin                        │
│   [CTA: "Buscar alojamiento"]                              │
└──────────────────┬────────────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────────────┐
│ 2. BÚSQUEDA (SIN LOGIN)                                   │
│   - Filtros: ciudad, fechas, huéspedes, precio, tipo     │
│   - Ordenar por: precio, rating, nuevas                  │
│   - Resultados: listado de propiedades                    │
│   - Datos visibles: nombre, foto, precio, rating         │
│   - Datos NO visibles: contacto anfitrión                │
│   [CTA: Click en propiedad]                              │
└──────────────────┬────────────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────────────┐
│ 3. DETALLE DE PROPIEDAD (SIN LOGIN)                       │
│   - Galería de fotos                                       │
│   - Descripción completa                                   │
│   - Amenidades                                             │
│   - Reseñas públicas (con puntuación)                     │
│   - Nombre/foto anfitrión (pero NO contacto)             │
│   - Correo + WhatsApp del ADMIN visible                  │
│   [CTA: "Reservar ahora"]                                │
└──────────────────┬────────────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────────────┐
│ 4. LOGIN/REGISTRO (REQUIRED)                              │
│   - Email + Password                                       │
│   - O: Registrarse (email, password, nombre)             │
│   [CTA: "Continuar reserva"]                             │
└──────────────────┬────────────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────────────┐
│ 5. FORMULARIO DE RESERVA                                  │
│   - Fechas (check-in, check-out) [pre-llenadas]         │
│   - Número de huéspedes [pre-llenado]                    │
│   - Opción de pago en alojamiento:                       │
│     o Pago completo (todo al llegar)                     │
│     o Pago diario (flexible)                              │
│   - Datos turista:                                        │
│     o Nombre [required]                                   │
│     o Email [required si no tiene teléfono]              │
│     o Teléfono WhatsApp [required si no tiene email]    │
│   [CTA: "Revisar y pagar"]                               │
└──────────────────┬────────────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────────────┐
│ 6. RESUMEN PRE-PAGO                                       │
│   - Propiedad (nombre, foto, ubicación)                  │
│   - Fechas (check-in, check-out, num noches)            │
│   - Opción pago seleccionada                             │
│   - Monto total (sin fee)                                │
│   - Fee: $10 USD (fijo, no reembolsable)                │
│   - Datos turista (confirmar)                            │
│   - Mensaje: "Pagarás solo $10 USD ahora. El resto      │
│     lo pagas en el alojamiento"                          │
│   [CTA: "Pagar ahora con cripto"]                        │
└──────────────────┬────────────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────────────┐
│ 7. CHECKOUT NOWPAYMENTS (CRIPTO)                          │
│   - Widget abierto (iframe o popup)                       │
│   - Opciones: USDT directo o Tarjeta (MoonPay)          │
│   - Si USDT: mostrar dirección wallet                     │
│   - Si Tarjeta: MoonPay convierte tarjeta → USDT        │
│   - Turista completa pago                                 │
│   - Esperar confirmación blockchain (1-3 min)            │
│   [CTA: "Pagar"]                                          │
└──────────────────┬────────────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────────────┐
│ 8. CONFIRMACIÓN - PENDIENTE APROBACIÓN                    │
│   - ✓ Pago de $10 USD confirmado                         │
│   - Status: "En espera de aprobación del administrador"  │
│   - Información: nombre propiedad, fechas, monto         │
│   - Mensaje: "Recibirás un email cuando sea aprobado"   │
│   - Información de contacto: correo + WhatsApp admin    │
│   - [CTA: "Volver al inicio" / "Ver mis reservas"]       │
│   - Email enviado a turista (confirmación pago)         │
└──────────────────┬────────────────────────────────────────┘
                   │
            ESPERA ADMIN │
                   │
        ┌──────────┴──────────┐
        │                     │
   [APROBADO]          [RECHAZADO]
        │                     │
┌───────▼──────────┐    ┌─────▼──────────────┐
│ EMAIL: Aprobada  │    │ EMAIL: Rechazada   │
│ - Detalles       │    │ - Motivo (opcional)│
│ - Propiedad info │    │ - Reembolso $10    │
│ - Contacto       │    │ - Contactar admin  │
│   anfitrión      │    │   si dudas         │
└─────────────────┘    └────────────────────┘
```

### 7.2 Flujo del Anfitrión

```
LOGIN → DASHBOARD → PUBLICAR PROPIEDAD (wait approval) →
VER RESERVAS APROBADAS → GESTIONAR DISPONIBILIDAD →
RECIBIR NOTIFICACIONES DE CHECK-IN
```

### 7.3 Flujo del Admin

```
LOGIN → DASHBOARD (resumen) → 
APROBACIONES PENDIENTES (propiedades + reservas) →
RESPONDER FEEDBACK →
VER REPORTES
```

---

## 8. SEGURIDAD

### 8.1 Autenticación
- JWT (JSON Web Tokens)
- Refresh tokens con rotación
- Sesión de 24 horas
- Salt + bcrypt para passwords

### 8.2 Multi-Tenancy
- Cada query filtra automáticamente por `tenant_id`
- Admin solo ve su tenant
- Turista solo ve propiedades su tenant
- Validación en cada endpoint

### 8.3 Pagos
- Verificación de firma de NOWPayments en webhook
- No se guarda datos sensibles de tarjeta (MoonPay los maneja)
- Encryption de `api_key` en base de datos

### 8.4 HTTPS
- Todo tráfico debe ser HTTPS
- HSTS headers
- CSP (Content Security Policy)

### 8.5 Rate Limiting
- Login: 5 intentos / 15 minutos
- API general: 100 req / minuto por IP
- Webhook: Sin limit (pero con verificación de firma)

---

## 9. MÓDULOS FUTUROS

> Estos módulos están diseñados y documentados pero NO se implementan en el MVP.
> Se construyen en fases posteriores sobre la misma arquitectura, sin modificar el core.
> Cada módulo es independiente — se puede activar o desactivar por tenant.

---

### 9.1 Módulo: Excursiones y Experiencias Grupales

**Descripción:** Espacio dedicado donde organizadores publican excursiones, tours y actividades grupales. Los turistas descubren, reservan y pagan su cupo. Reutiliza el mismo sistema de pagos del core.

**Casos de uso:**
- Tour a la ciudad de La Habana para 12 personas
- Excursión a Viñales con cupo limitado a 8
- Clase de salsa grupal con reserva previa

**Nuevos roles:**
- **Organizador:** Publica y gestiona excursiones (similar a Anfitrión)

**Nuevas colecciones MongoDB:**
```javascript
experiences: {
  _id, tenant_id, organizer_id,
  title, description, category,
  location: { city, address, latitude, longitude },
  date, duration_hours,
  max_participants, current_participants,
  price_per_person, currency,
  images: [...],
  includes: [...],          // qué incluye el precio
  requirements: [...],      // qué llevar
  cancellation_policy,
  status,                   // draft, active, full, cancelled, completed
  created_at, updated_at
}

experience_bookings: {
  _id, tenant_id, experience_id,
  tourist_id, organizer_id,
  num_spots,                // cupos reservados
  fee_amount, fee_paid,
  fee_transaction_id,
  status,                   // pending_payment, confirmed, cancelled, completed
  hold_expires_at,
  created_at
}

experience_waitlist: {
  _id, tenant_id, experience_id,
  tourist_id, position,
  notified_at,
  created_at
}
```

**Nuevos endpoints API:**
```
GET  /api/experiences                     → Listado con filtros
GET  /api/experiences/:id                 → Detalle + cupos disponibles
POST /api/experiences (Organizador)       → Crear excursión
PUT  /api/experiences/:id (Organizador)   → Editar
POST /api/experiences/:id/book (Turista)  → Reservar cupo → genera invoice NOWPayments
POST /api/experiences/:id/waitlist        → Unirse a lista de espera
GET  /api/organizer/experiences           → Panel del organizador
GET  /api/organizer/bookings              → Reservas por excursión
POST /api/admin/experiences/:id/approve   → Admin aprueba excursión
```

**Flujo de reserva:**
```
Turista ve excursión → Selecciona número de cupos →
Paga fee por NOWPayments → Hold 3h →
Admin aprueba → Confirmación →
Email con detalles del punto de encuentro
```

**Wireflow (páginas nuevas):**
```
/experiences              → Catálogo de excursiones
/experiences/:id          → Detalle + galería + mapa + reviews
/experiences/:id/book     → Formulario reserva de cupos
/organizer/dashboard      → Panel del organizador
/organizer/create         → Crear nueva excursión
```

**Monetización futura:**
- Fee de plataforma por cupo reservado
- Comisión sobre precio total de la excursión
- Featured listings (excursiones destacadas pagando)

---

### 9.2 Módulo: Community — Muro de Viajes

**Descripción:** Red social interna de la plataforma donde turistas publican sus experiencias, fotos de viaje, recomendaciones gastronómicas y vivencias fuera de los reviews formales. Genera contenido orgánico, crea comunidad y abre una vía de monetización futura vía publicidad.

**Visión:**
- Turistas se convierten en bloggers de viaje dentro de la plataforma
- Cada post puede etiquetar propiedades, excursiones y lugares
- El contenido generado atrae nuevos usuarios orgánicamente (SEO)
- Bloggers con audiencia pueden monetizar su contenido (fase futura)

**Tipos de contenido:**
- Foto/álbum de viaje
- Experiencia culinaria
- Review extendido de un lugar (no alojamiento)
- Recomendación de actividad
- Tip de viajero

**Nuevas colecciones MongoDB:**
```javascript
posts: {
  _id, tenant_id, author_id,
  type,                     // photo, experience, tip, review_extended
  caption, body,
  media: [{ url, type, order }],   // imágenes/videos (Cloudinary)
  location_tag: { name, city, latitude, longitude },
  property_tag: ObjectId,   // ref a propiedad (opcional)
  experience_tag: ObjectId, // ref a excursión (opcional)
  hashtags: [...],
  likes_count, comments_count, saves_count,
  status,                   // published, hidden, reported
  created_at, updated_at
}

post_interactions: {
  _id, tenant_id, post_id, user_id,
  type,                     // like, save, report
  created_at
}

post_comments: {
  _id, tenant_id, post_id,
  author_id, text,
  likes_count,
  parent_comment_id,        // para respuestas anidadas
  status,
  created_at
}

follows: {
  _id, tenant_id,
  follower_id, following_id,
  created_at
}
```

**Extensión del perfil de usuario (non-breaking):**
```javascript
// Campos adicionales en colección users existente:
community: {
  bio_travel: "...",        // bio específica de viajero
  posts_count: 0,
  followers_count: 0,
  following_count: 0,
  visited_places: [...],
  is_blogger: false,        // activa monetización futura
  monetization_enabled: false
}
```

**Nuevos endpoints API:**
```
GET  /api/feed                         → Feed principal (siguiendo + recomendado)
GET  /api/feed/trending                → Posts trending
GET  /api/feed/nearby                  → Posts cerca de una ubicación
POST /api/posts (Turista)              → Crear post
PUT  /api/posts/:id                    → Editar post
DELETE /api/posts/:id                  → Eliminar post
POST /api/posts/:id/like               → Like/Unlike
POST /api/posts/:id/save               → Guardar/Desguardar
POST /api/posts/:id/report             → Reportar post
POST /api/posts/:id/comments           → Comentar
GET  /api/profile/:id/posts            → Posts de un usuario
POST /api/follow/:id                   → Seguir usuario
DELETE /api/follow/:id                 → Dejar de seguir
```

**Wireflow (páginas nuevas):**
```
/community                → Feed principal (Home del módulo)
/community/trending       → Posts trending
/community/create         → Crear nuevo post
/community/post/:id       → Post individual + comentarios
/profile/:id              → Perfil público del viajero/blogger
/profile/:id/posts        → Todos los posts del usuario
```

**Infraestructura adicional requerida:**
- **Cloudinary** (o equivalente): almacenamiento de fotos/videos
  - Plan gratuito: 25 GB, suficiente para MVP del módulo
  - Integración: multer (Node.js) → Cloudinary SDK

**Monetización futura (arquitectura preparada desde inicio):**
```
Nivel 1: Posts orgánicos (gratis siempre)
Nivel 2: Blogger verificado (badge, analytics de sus posts)
Nivel 3: Sponsored posts (negocios pagan para aparecer en feed)
Nivel 4: Revenue sharing con bloggers top (% de ad revenue)
Nivel 5: Suscripción premium para turistas (contenido exclusivo)
```

---

### 9.3 Módulo: Temas y Diseño Editable

**Descripción:** Sistema de configuración visual que permite editar colores, fuentes y elementos de diseño sin tocar la lógica de la aplicación. Útil tanto para el admin del tenant como para personalizar la plataforma sin experiencia técnica profunda.

**Implementación:**

**Variables CSS centralizadas** (`/frontend/css/theme.css`):
```css
:root {
  /* Colores principales */
  --color-primary:       #2C5F8D;  /* Azul océano */
  --color-secondary:     #F39C12;  /* Naranja cálido */
  --color-accent:        #27AE60;  /* Verde confirmación */
  --color-danger:        #E74C3C;  /* Rojo error/rechazo */
  --color-background:    #F8F9FA;
  --color-surface:       #FFFFFF;
  --color-text-primary:  #2C3E50;
  --color-text-secondary:#7F8C8D;

  /* Tipografía */
  --font-family:         'Inter', sans-serif;
  --font-size-base:      16px;
  --font-size-sm:        14px;
  --font-size-lg:        18px;
  --font-size-xl:        24px;
  --font-size-hero:      48px;

  /* Espaciado */
  --spacing-xs:          4px;
  --spacing-sm:          8px;
  --spacing-md:          16px;
  --spacing-lg:          24px;
  --spacing-xl:          48px;

  /* Bordes y sombras */
  --border-radius:       8px;
  --border-radius-lg:    16px;
  --shadow-sm:           0 2px 4px rgba(0,0,0,0.08);
  --shadow-md:           0 4px 16px rgba(0,0,0,0.12);
}
```

**Archivo de configuración de contenido** (`/frontend/js/config.js`):
```javascript
const APP_CONFIG = {
  // Branding
  app_name:        "Da-El World Travelers",
  app_tagline:     "Viaja con confianza",
  app_logo:        "/assets/logo.svg",

  // Contacto admin
  admin_email:     "admin@da-elworldtravelers.com",
  admin_whatsapp:  "+53 ...",

  // Redes sociales
  social: {
    instagram:     "https://instagram.com/...",
    facebook:      "https://facebook.com/...",
    tiktok:        "https://tiktok.com/...",
    whatsapp:      "https://wa.me/..."
  },

  // Configuración de pagos (visual)
  fee_amount:      10,
  fee_currency:    "USD",
  fee_display:     "$10 USD",

  // Feature flags (activar/desactivar secciones)
  features: {
    experiences_module:  false,   // ← cambiar a true cuando esté listo
    community_module:    false,   // ← cambiar a true cuando esté listo
    dark_mode:           false
  }
}
```

**¿Afecta el funcionamiento cambiar estos valores?**
- Cambios en `theme.css`: **NO** — solo afecta apariencia
- Cambios en `config.js` (branding/contacto): **NO** — solo afecta textos visibles
- Cambios en `features` flags: **SÍ** — activan/desactivan módulos completos

---

## 10. ROADMAP

### Fase 1: MVP Core — Reservas (Semanas 1-4)
**Objetivo: App funcional con reservas y pagos**
- [x] Especificación completa (HECHO)
- [ ] Setup: Node.js + Express + MongoDB + estructura base
- [ ] Auth: registro, login, JWT, refresh tokens
- [ ] Properties: CRUD, búsqueda, filtros
- [ ] Bookings: crear, hold 3h, flujo completo
- [ ] Pagos: integración NOWPayments/BTCPay + webhook
- [ ] Admin panel: aprobaciones de propiedades y reservas
- [ ] Frontend: landing, búsqueda, detalle propiedad, formulario reserva
- [ ] Deploy: Railway (backend) + Vercel (frontend)

### Fase 2: Features Core (Semanas 5-8)
**Objetivo: Experiencia completa para turistas y anfitriones**
- [ ] Reviews: sistema ciego (ambas partes)
- [ ] Feedback: formulario + respuesta admin
- [ ] Dashboard turista: mis reservas, historial, reviews pendientes
- [ ] Panel anfitrión: publicar propiedades, calendario, ver reservas
- [ ] Emails: confirmación pago, aprobación, rechazo, recordatorios
- [ ] PWA: service worker, instalable en móvil, offline básico
- [ ] theme.css y config.js centralizados (diseño editable)

### Fase 3: Polish + B2B (Semanas 9-12)
**Objetivo: Estable para primeros usuarios reales + modelo B2B**
- [ ] UX improvements basado en feedback real de usuarios
- [ ] Multi-idioma completo: ES, EN, FR en producción
- [ ] SaaS panel: crear nuevos tenants, dominios personalizados
- [ ] Documentación API básica
- [ ] Testing end-to-end + auditoría de seguridad
- [ ] Gateway de pagos: confirmar NOWPayments o migrar a BTCPay/CoinGate

### Fase 4: Módulo Excursiones (Mes 4-5)
**Objetivo: Segunda línea de negocio, misma plataforma**
- [ ] Colecciones MongoDB: experiences, experience_bookings, experience_waitlist
- [ ] API endpoints de excursiones (ver sección 9.1)
- [ ] Panel del organizador
- [ ] Frontend: catálogo, detalle, booking de cupos
- [ ] Lista de espera automática
- [ ] Integración con sistema de pagos existente
- [ ] Admin: aprobación de excursiones

### Fase 5: Módulo Community (Mes 6-7)
**Objetivo: Red social de viajeros + base para monetización**
- [ ] Integración Cloudinary (almacenamiento de imágenes)
- [ ] Colecciones MongoDB: posts, post_interactions, post_comments, follows
- [ ] Extensión de perfil de usuario (non-breaking)
- [ ] API endpoints de Community (ver sección 9.2)
- [ ] Frontend: feed, crear post, perfil de viajero
- [ ] Sistema de hashtags y etiquetado de lugares
- [ ] Moderación básica de contenido (admin)

### Fase 6: Monetización y Escalabilidad (Mes 8+)
**Objetivo: Plataforma auto-sostenible con múltiples fuentes de ingreso**
- [ ] Revenue sharing con bloggers top
- [ ] Sponsored posts y publicidad en feed
- [ ] Analytics avanzados por tenant
- [ ] Integraciones adicionales de pago (CoinGate, Stripe non-US)
- [ ] Mobile app nativa (si el volumen lo justifica)
- [ ] Marketplace de tenants (directorio B2B público)

---

## CONCLUSIÓN

Da-El World Travelers está diseñada como una plataforma de turismo completa y escalable. El MVP resuelve el problema inmediato (reservas de alojamientos en Cuba para turistas internacionales). Los módulos futuros — Excursiones y Community — convierten la plataforma en un ecosistema completo que genera engagement, contenido orgánico y múltiples fuentes de ingreso.

La arquitectura modular garantiza que cada nueva función se añade sin romper lo existente, y el diseño multi-tenant desde el día 1 permite escalar a toda Latinoamérica sin reescribir código.

**Estado actual:** Especificación completa ✅ — Iniciando desarrollo del backend.

---

*Documento de referencia — Versión 2.0 — Julio 2026*
*Da-El World Travelers — "Viaja con confianza"*
