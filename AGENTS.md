# AGENTS.md — Elysio Experiences

## Architecture

Multi-tenant vacation rental platform (Cuba focus). Tourists search/book properties; hosts list properties; admin manages everything.

- **Backend**: Express + Mongoose (MongoDB), single `backend/` directory. Entry: `backend/server.js`
- **Frontend**: Vanilla JS SPA (no framework, no build step). Entry: `frontend/index.html` → `frontend/js/app.js`
- **Deployment**: Frontend on Vercel. Vercel proxies `/api/*` to the backend URL hardcoded in `frontend/vercel.json` and `frontend/middleware.js` (currently Render, `booking-platform-f8co.onrender.com`). If the backend moves, update both files.

## Commands

### Backend (run from `backend/`)

```bash
npm test            # Jest — export smoke tests + logic tests (tests/logic.test.js), ~2s
npm run lint        # ESLint
npm run lint:fix    # ESLint auto-fix
npm run dev         # Nodemon dev server (port 3000)
npm run dev:local   # Full local stack: API :3000 + in-memory MongoDB with demo users + web :5500 (never touches prod)
npm run worker      # Cron jobs only (use with RUN_JOBS=false on the web service)
npm run backup      # Dump every collection to backend/backups/<date>/ (EJSON, gitignored)
npm run reviews:dedupe [-- --fix]  # Find/remove duplicate reviews and sync Review indexes
```

### Frontend

No build step. Serve `frontend/` with any static server (e.g. `npx serve frontend`); in local dev `api.js` calls the backend on port 3000.
CI (`.github/workflows/ci.yml`) runs lint, tests and `npm audit` for the backend, and checks i18n keys and JS syntax for the frontend.

## Key Constraints

- **No `full_online` booking type**. Only `pre_booking` with a $7 USD fee paid via QvaPay or manual PayPal. Never add `full_online` back.
- **No `package.json` in frontend** — no npm install, no bundler, no tests for frontend.
- **i18n uses 3 locales**: `frontend/locales/{en,es,fr}.json`. All user-facing strings must exist in all 3.
- **Multi-tenant**: Every DB query must filter by `tenant_id` from `req.tenantId` (set by `middleware/tenant.js`). `setTenant` is fail-closed (503 without tenant) and must run AFTER `protect`/`optionalAuth` so it uses the user's tenant.
- **Role guard**: `guard()` in `app.js` checks `auth.getRole()` against allowed roles. Admin routes are also gated by `authorize('admin')` middleware in backend.

## Code Conventions

- **Backend**: CommonJS (`require`), Express-style `(req, res, next)`, Mongoose models. No TypeScript.
- **Frontend**: ES modules (`import/export`), vanilla DOM manipulation. No React/Vue/etc.
- **Frontend page pattern**: Each page exports `{ render(), init() }`. `render()` returns HTML string, `init()` attaches event listeners.
- **CSS**: Single file `frontend/css/styles.css` with CSS custom properties (`--primary`, `--space-lg`, etc.).
- **Locale keys**: Flat dot-notation (`pages.howItWorks.title`). Duplicate structures exist: `howItWorks` (landing) vs `pages.howItWorks` (dedicated page).
- **ESLint**: `prefer-const`, `no-var`, `eqeqeq: always`, `no-unused-vars` (ignore `_` prefix).

## Testing

- Tests live in `backend/tests/`: `app.test.js` (export smoke tests) and `logic.test.js` (behaviour, models mocked with `jest.spyOn`). Frontend has no tests.
- Add a test to `logic.test.js` for any change to booking/payment/commission logic.
- `jest.mock()` factories **cannot** reference out-of-scope variables (Jest sandbox restriction). Use `require()` inside factories.

## Common Gotchas

- **Port**: Backend default is 3000 (in `env.js`). Frontend `api.js` also hits port 3000. If deploying separately, `api.js` uses `window.location.hostname` with port.
- **`.env` in backend**: Contains secrets (JWT, MongoDB URI, Cloudinary, QvaPay, VAPID). Already in `.gitignore`. Never commit it. `server.js` refuses to start without `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
- **Seeds**: `scripts/seed.js` needs `SEED_ADMIN_PASSWORD`; demo seeds refuse to run with `NODE_ENV=production`. Never hardcode passwords.
- **Timezone dates**: Booking dates are calendar dates stored at UTC midnight: format them with `formatDate` (uses UTC) and compute "today" with `localDateISO()` from `utils/formatters.js` — never `toISOString()`.
- **Experience times are Cuba time**: the organizer's `datetime-local` value is interpreted as `America/Havana` (`utils/timezone.js`); display with `formatExperienceDate/Time` and edit with `toExperienceInputValue`.
- **Booking overlap check**: Uses strict `$lt`/`$gt` (same-day turnover allowed). Do NOT switch to `$lte`. Check + create runs inside `withPropertyLock` (`utils/propertyLock.js`, atomic lock on the property doc, safe with several instances); date blocks use the same lock. A post-create re-check (earlier `_id` wins) remains as a second safety net.
- **2FA**: `otplib` (TOTP, window 1) with replay protection (`two_factor.last_used_step`). Backup codes are stored hashed.
- **Inline handlers are not allowed** (CSP `script-src 'self'`): use `data-action="fnName" data-arg="..."` (+ `data-arg2`...) and define `window.fnName`; `this` is the element and the event is the last argument. For `<select>` use `data-change-action`.
- **i18n.t()**: Returns key itself if translation missing (uses `??` not `||` to preserve empty strings).
- **changeLang**: Calls `i18n.setLang()` + `window.rerenderCurrentPage()` — never `location.reload()`.
- **User model**: Has both `phone` and `whatsapp_phone` as separate fields.
- **Host properties**: Hosts see only their own properties via `GET /api/properties/my` (authenticated). Never modify the public `GET /api/properties` to expose host-only data.
- **BookingCard**: Takes `mode` string param (`'admin'`/`'host'`/`'tourist'`), not boolean `showActions`.
- **deleteHost**: Validates no active bookings before deleting. Required by business logic.
- **adminController.updateSettings**: Uses `!== undefined` checks (not `if (val)`) to allow clearing fields. Only branding, languages and public contact are settings; the fee is fixed at $7 and QvaPay credentials are env vars.
- **Booking lifecycle**: `jobs/bookingLifecycle.js` auto-completes approved bookings 24 h after check-out and publishes blind reviews after 14 days. Commissions are computed from `completed` bookings for the current AND previous month.
- **Cron jobs**: all registered in `jobs/index.js`. They must run in ONE process: either the web server (default) or `worker.js` with `RUN_JOBS=false` on the web service.
- **Hold expiry**: PayPal bookings where the tourist reported payment get 72 h extra before cancelling; QvaPay bookings are re-checked against QvaPay before cancelling.
- **Status changes**: Use conditional `updateOne({ _id, status: <expected> })` for booking/experience-booking transitions (avoids double cancellations releasing spots twice).
- **Images**: Always pass host/organizer `images` through `utils/images.js#sanitizeImages` (only own-folder `public_id`s are kept; deletion ownership depends on it).
- **API errors**: Backend returns `{ success:false, error, errors? }`. Frontend `api.js` refreshes the token on 401 automatically.

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
