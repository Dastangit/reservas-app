# AGENTS.md — Da-El World Travelers

## Architecture

Multi-tenant vacation rental platform (Cuba focus). Tourists search/book properties; hosts list properties; admin manages everything.

- **Backend**: Express + Mongoose (MongoDB), single `backend/` directory. Entry: `backend/server.js`
- **Frontend**: Vanilla JS SPA (no framework, no build step). Entry: `frontend/index.html` → `frontend/js/app.js`
- **Deployment**: Frontend on Vercel, backend on SnapDeploy. Vercel proxies `/api/*` to backend.

## Commands

### Backend (run from `backend/`)

```bash
npm test            # Jest — 23 smoke tests, ~1.5s
npm run lint        # ESLint
npm run lint:fix    # ESLint auto-fix
npm run dev         # Nodemon dev server (port 3000)
```

### Frontend

No build step. Root `server.js` serves static files from `frontend/` on port 3000. Just open `http://localhost:3000`.

## Key Constraints

- **No `full_online` booking type**. Only `pre_booking` with $7 USD fee via crypto. Never add `full_online` back.
- **No `package.json` in frontend** — no npm install, no bundler, no tests for frontend.
- **i18n uses 3 locales**: `frontend/locales/{en,es,fr}.json`. All user-facing strings must exist in all 3.
- **Multi-tenant**: Every DB query must filter by `tenant_id` from `req.tenantId` (set by `middleware/tenant.js`).
- **Role guard**: `guard()` in `app.js` checks `auth.getRole()` against allowed roles. Admin routes are also gated by `authorize('admin')` middleware in backend.

## Code Conventions

- **Backend**: CommonJS (`require`), Express-style `(req, res, next)`, Mongoose models. No TypeScript.
- **Frontend**: ES modules (`import/export`), vanilla DOM manipulation. No React/Vue/etc.
- **Frontend page pattern**: Each page exports `{ render(), init() }`. `render()` returns HTML string, `init()` attaches event listeners.
- **CSS**: Single file `frontend/css/styles.css` with CSS custom properties (`--primary`, `--space-lg`, etc.).
- **Locale keys**: Flat dot-notation (`pages.howItWorks.title`). Duplicate structures exist: `howItWorks` (landing) vs `pages.howItWorks` (dedicated page).
- **ESLint**: `prefer-const`, `no-var`, `eqeqeq: always`, `no-unused-vars` (ignore `_` prefix).

## Testing

- Tests live in `backend/tests/`. Currently only `app.test.js` (smoke/export tests).
- Tests verify exports exist, not integration logic. Frontend has no tests.
- `jest.mock()` factories **cannot** reference out-of-scope variables (Jest sandbox restriction). Use `require()` inside factories.
- SendGrid warning in test output is expected (no SG key in test env).

## Common Gotchas

- **Port**: Backend default is 3000 (in `env.js`). Frontend `api.js` also hits port 3000. If deploying separately, `api.js` uses `window.location.hostname` with port.
- **`.env` in backend**: Contains secrets (JWT, MongoDB URI, SendGrid, NOWPayments). Already in `.gitignore`. Never commit it.
- **Timezone dates**: Use `toLocaleDateString('sv-SE')` (not `toISOString()`) to avoid UTC offset shifting dates.
- **Booking overlap check**: Uses `$lte` (not `$lt`) to prevent race conditions.
- **i18n.t()**: Returns key itself if translation missing (uses `??` not `||` to preserve empty strings).
- **changeLang**: Calls `i18n.setLang()` + `window.rerenderCurrentPage()` — never `location.reload()`.
- **User model**: Has both `phone` and `whatsapp_phone` as separate fields.
- **Host properties**: Hosts see only their own properties via `GET /api/properties/my` (authenticated). Never modify the public `GET /api/properties` to expose host-only data.
- **BookingCard**: Takes `mode` string param (`'admin'`/`'host'`/`'tourist'`), not boolean `showActions`.
- **deleteHost**: Validates no active bookings before deleting. Required by business logic.
- **adminController.updateSettings**: Uses `!== undefined` checks (not `if (val)`) to allow clearing fields.

## File Reference

| What | Where |
|------|-------|
| API base URL | `frontend/js/api.js` |
| Auth (login/register/token) | `backend/controllers/authController.js` |
| Booking logic | `backend/controllers/bookingController.js` |
| Property CRUD | `backend/controllers/propertyController.js` |
| Host properties route | `backend/routes/properties.js` (`GET /my`) |
| Tenant resolution | `backend/middleware/tenant.js` |
| Frontend routing | `frontend/js/app.js` |
| i18n | `frontend/js/i18n.js` + `frontend/locales/*.json` |
| All frontend pages | `frontend/js/pages/*.js` (35 pages) |
