# 📚 GUÍA DE USO — Da-El World Travelers
## Documentos del Proyecto

**Versión:** 2.0 — Julio 2026  
**Estado:** En Desarrollo — Fase 1 (MVP)

---

## 🎯 Resumen Rápido

Tienes **3 documentos** del mismo proyecto, cada uno para un propósito distinto. Elige según lo que necesites en ese momento.

| Documento | Para qué sirve | Quién lo usa |
|-----------|---------------|--------------|
| `01-ESPECIFICACION-TECNICA-COMPLETA.md` | Referencia técnica diaria | Developer, tú mismo |
| `02-SPEC-PARA-IA.json` | Contexto para pedirle a IA que codifique | Claude, ChatGPT |
| `03-DOCUMENTO-PROFESIONAL.docx` | Presentar a inversores o socios | Inversores, stakeholders |

---

## 📄 DOCUMENTO 1: `01-ESPECIFICACION-TECNICA-COMPLETA.md`

### ¿Qué contiene? (v2.0)
Tu **"fuente de verdad técnica"** — contiene todo el proyecto de principio a fin:

**Secciones Core (MVP actual):**
- Arquitectura multi-tenant
- Funcionalidades: reservas, búsqueda, reviews, feedback
- Sistema de pagos (NOWPayments / BTCPay)
- Modelos de datos MongoDB (schemas completos)
- Endpoints API REST (todos los que necesitas para el MVP)
- Flujos UX pantalla por pantalla
- Seguridad y autenticación

**Secciones Nuevas (v2.0):**
- **Sección 9.1:** Módulo Excursiones Grupales — diseño completo para Fase 4
- **Sección 9.2:** Módulo Community (muro de viajes tipo Instagram) — diseño para Fase 5
- **Sección 9.3:** Sistema de tema editable (CSS variables + config.js)
- **Sección 10:** Roadmap actualizado con 6 fases completas

### ¿Cuándo usarlo?
- ✅ Durante el desarrollo diario como referencia
- ✅ Para compartir con developers o freelancers
- ✅ Para entender qué viene en cada fase
- ✅ Guardarlo en Git (versionado)

---

## 🔗 DOCUMENTO 2: `02-SPEC-PARA-IA.json`

### ¿Qué contiene? (v2.0)
Versión **estructurada en JSON** de toda la especificación, optimizada para que Claude u otra IA la entienda y genere código correcto:

- Stack tecnológico completo
- Schemas de MongoDB (core + futuros)
- Todos los endpoints (core + futuros marcados por fase)
- Features separadas por fase (MVP vs futuro)
- Roadmap estructurado
- Notas importantes sobre decisiones de arquitectura

### ¿Cuándo usarlo?
- ✅ Pegar en un prompt cuando pidas a IA que implemente algo
- ✅ "Claude, implementa el endpoint de bookings según este JSON"
- ✅ Referencia rápida de estructura de datos

### Cómo usarlo con Claude:
```
Tú: "Claude, necesito que implementes el endpoint POST /api/bookings.
     Aquí está el spec completo del proyecto: [pega el JSON]
     
     Requisitos específicos:
     - Usar el schema de bookings del JSON
     - Implementar el hold de 3 horas
     - Integrar con NOWPayments según el payment_flow del JSON"
```

---

## 📘 DOCUMENTO 3: `03-DOCUMENTO-PROFESIONAL.docx`

### ¿Qué contiene?
Versión **profesional en Word** del proyecto — sin código, sin diagramas técnicos. Legible para cualquier persona.

### ¿Cuándo usarlo?
- ✅ Presentar el proyecto a inversores
- ✅ Enviar a socios potenciales
- ✅ Documentación formal para reuniones
- ✅ Imprimir o proyectar en presentaciones

---

## 🗺️ ESTADO ACTUAL DEL PROYECTO

### ✅ Completado
- [x] Especificación técnica completa (v2.0)
- [x] Frontend desplegado en Vercel
- [x] Repositorio en GitHub
- [x] Diseño de módulos futuros (Excursiones + Community)

### 🔄 En Progreso
- [ ] Verificación gateway de pagos (NOWPayments / BTCPay — email enviado a soporte)
- [ ] Setup backend Node.js + MongoDB

### ⏳ Pendiente (por orden)
- [ ] Fase 1: Backend + Auth + Properties + Bookings + Pagos
- [ ] Fase 2: Reviews + Feedback + Dashboards + Emails + PWA
- [ ] Fase 3: Polish + Multi-idioma + SaaS B2B
- [ ] Fase 4: Módulo Excursiones
- [ ] Fase 5: Módulo Community
- [ ] Fase 6: Monetización y escalado

---

## 🏗️ ARQUITECTURA DE MÓDULOS

```
DA-EL WORLD TRAVELERS
│
├── CORE (MVP — Fases 1-3)
│   ├── Reservas de alojamientos
│   ├── Sistema de pagos crypto
│   ├── Reviews + Feedback
│   ├── Panel Admin / Anfitrión / Turista
│   └── PWA (instalable en móvil)
│
├── MÓDULO: EXCURSIONES (Fase 4)
│   ├── Catálogo de excursiones grupales
│   ├── Reserva de cupos
│   ├── Lista de espera
│   └── Panel del Organizador
│
├── MÓDULO: COMMUNITY (Fase 5)
│   ├── Muro de viajes (posts, fotos)
│   ├── Experiencias culinarias
│   ├── Sistema de follows
│   ├── Hashtags + location tagging
│   └── Base para monetización bloggers
│
└── MONETIZACIÓN (Fase 6)
    ├── Revenue share con bloggers
    ├── Sponsored posts
    ├── Featured listings
    └── Suscripciones premium
```

---

## 💡 FLUJO DE TRABAJO RECOMENDADO

### Día a día desarrollando:
1. Abre el **Markdown (01-)** para entender qué implementar
2. Pega el **JSON (02-)** en Claude para pedir código
3. Actualiza ambos cuando cambies una decisión

### Cuando presentes el proyecto:
1. Abre el **Word (03-)** — sin código, limpio
2. Muestra sección de Visión General + Modelo de Negocio
3. Si preguntan por los módulos futuros — sección 9 del Markdown

### Cuando contrates un developer:
1. Envía el **Markdown (01-)** completo
2. Indica en qué Fase está el trabajo actual
3. El developer tiene todo el contexto sin preguntas

---

## 🛠️ STACK SIN CAMBIOS

Una pregunta frecuente: **¿necesito aprender nuevos lenguajes para los módulos nuevos?**

**No.** El stack permanece igual para todo:

| Componente | Tecnología |
|-----------|-----------|
| Frontend (todas las fases) | HTML + CSS + JavaScript vanilla |
| Backend (todas las fases) | Node.js + Express.js |
| Base de datos (todas las fases) | MongoDB |
| Pagos | NOWPayments o BTCPay Server |
| Fotos/Videos (solo Fase 5) | Cloudinary (servicio externo, se integra con Node.js) |
| Chat tiempo real (solo Fase 5) | Socket.io (librería JavaScript) |

---

## 📁 ESTRUCTURA DE CARPETAS RECOMENDADA

```
D:\Reservas project\
│
├── 📄 01-ESPECIFICACION-TECNICA-COMPLETA.md  ← Fuente de verdad
├── 🔗 02-SPEC-PARA-IA.json                   ← Para prompts a IA
├── 📘 03-DOCUMENTO-PROFESIONAL.docx           ← Para inversores
├── 📚 README-GUIA-DE-USO.md                  ← Este archivo
│
├── /backend                                   ← Node.js + Express
│   ├── /src
│   │   ├── /models        ← Schemas MongoDB
│   │   ├── /routes        ← Endpoints API
│   │   ├── /controllers   ← Lógica de negocio
│   │   ├── /middleware    ← Auth, rate limit, etc.
│   │   └── /services      ← NOWPayments, email, etc.
│   ├── server.js
│   └── package.json
│
├── /frontend                                  ← HTML + CSS + JS
│   ├── /css
│   │   ├── theme.css      ← Variables de diseño (editable)
│   │   └── main.css
│   ├── /js
│   │   ├── config.js      ← Configuración editable
│   │   └── app.js
│   ├── /i18n
│   │   ├── es.json
│   │   ├── en.json
│   │   └── fr.json
│   └── index.html
│
└── /docs                                      ← Documentación adicional
```

---

## 📌 CHEATSHEET — ¿Qué documento necesito?

| Pregunta | Respuesta |
|----------|-----------|
| "¿Cómo está estructurada la BD?" | → Markdown (01-) Sección 5 |
| "¿Qué endpoints necesito?" | → Markdown (01-) Sección 6 |
| "¿Cómo funciona el módulo de excursiones?" | → Markdown (01-) Sección 9.1 |
| "¿Cómo funciona el Community module?" | → Markdown (01-) Sección 9.2 |
| "Quiero que Claude genere código" | → JSON (02-) completo |
| "Necesito explicar a inversores" | → Word (03-) |
| "¿Qué viene en cada fase?" | → Markdown (01-) Sección 10 |
| "¿Cómo edito el diseño sin romper nada?" | → Markdown (01-) Sección 9.3 |

---

## 🔐 REGLA DE ORO

> **El Markdown (01) es la fuente de verdad general del proyecto.**
> Si hay discrepancia entre los 3 documentos originales, el Markdown gana.
> Cuando cambies algo importante: edita el Markdown → actualiza el JSON → regenera el Word.

### ⚠️ Excepción vigente (Julio 2026)

Existen dos documentos adicionales, **`04-PLAN-DISPONIBILIDAD-Y-FEE-MENSUAL.md`** y **`05-SPEC-TECNICA-DISPONIBILIDAD-Y-FEE.md`**, que cubren una feature nueva (calendario de disponibilidad, notificaciones al anfitrión, fee mensual del 10% y cumplimiento escalonado). **Para todo lo relacionado con esa feature, 04 y 05 tienen precedencia sobre 01 y 02** — el `01` tiene el schema de `Property` parcialmente actualizado pero los endpoints y el modelo de fee del `01`/`02` están desactualizados (siguen mostrando el `PUT .../availability` viejo y el fee flat de $3, ya reemplazados).

**Al pedirle a una IA que implemente esta feature: usa solo `04` + `05` + `CHANGELOG.md`. No incluyas `02-SPEC-PARA-IA.json` ni `03-DOCUMENTO-PROFESIONAL.docx` en ese prompt** — contradicen el diseño nuevo.

Esta excepción se resuelve la próxima vez que se sincronicen los 3 documentos originales con el estado real del proyecto (fusionar 04/05 dentro de 01 y regenerar 02/03).

---

*Versión 2.0 — Julio 2026*  
*Da-El World Travelers — "Viaja con confianza"*  
*Para: Dats — Developer, Investor, Marketing Creator*
