# Good Oil CRM — project guide

Small CRM for a fuel-station owner. Django + React + Telegram bot. Solo dev (zafar). Dev-only right now — no prod deployment yet.

## Stack

- **Backend**: Django 5.2 + DRF 3.17 + TokenAuthentication, SQLite in dev, Pillow for image uploads. Aiogram 3 Telegram bot accessing Django ORM directly (no HTTP).
- **Frontend**: React 19 + Vite + axios + react-router 7. TypeScript strict. No UI library — inline CSS-in-template + CSS variables from `App.css`.
- **Repo layout**: `backend/` (Django project + bot), `frontend/` (Vite SPA).

## Run

Two terminals. Venv must be active for backend commands.

```powershell
# Backend
cd d:\Projects\good_oil\backend
.\venv\Scripts\Activate.ps1
python manage.py runserver 8000

# Frontend
cd d:\Projects\good_oil\frontend
npm run dev
```

Backend on http://127.0.0.1:8000, frontend on http://localhost:5173. CORS allows 5173. StatReloader auto-applies code/migration changes on save.

Owner account: `zafar` (is_staff=True). Token can be minted via:
```
python manage.py shell -c "from django.contrib.auth.models import User; from rest_framework.authtoken.models import Token; u=User.objects.get(username='zafar'); t,_=Token.objects.get_or_create(user=u); print(t.key)"
```

## Working style — overrides global protocol

The user wants minimal ceremony. Override the global CLAUDE.md flow as follows:

- **No clarifying questions for things already decided** (see "Locked decisions" below).
- **Skip architect** unless the change is genuinely cross-cutting (auth model, schema migration affecting >1 model, infra). Default = jump straight to engineers.
- **Skip QA reviewer** for pure UI cosmetic changes (color, spacing, modal animation, new optional field) and for changes that only loosen validation. Run QA when: adding a new write endpoint, changing permissions, adding a destructive action.
- **Skip security-auditor** unless the change touches: auth (login/password/token), permissions, file upload validation, raw SQL, external network calls, secrets. Hard delete with confirmation + existing IsAdminUser does NOT need security review.
- **Single Agent dispatch is fine** for small isolated work. Reserve parallel BE+FE dispatch for changes that genuinely span both layers.
- **For pure visual UI polish** (button colors, spacing, replacing a `<select>` with custom dropdown, etc.) — just do it inline as TL. No dispatch.
- **Don't summarize at the end of every reply.** User reads the diff. Keep finishing summaries to 1-3 short bullets max.
- **Don't ask the same product question twice.** If the user already said "hard delete" once, don't re-ask on the next destructive feature.
- **Bias toward shipping.** Follow-ups list is fine; perfection is not the bar.

## Locked product decisions (do NOT re-ask)

- **Language**: Russian everywhere (UI labels, error messages, button text, validation messages). Code identifiers stay English.
- **Theme**: light + dark both supported. Use CSS variables (`var(--panel)`, `var(--accent)`, `var(--text)`, etc. from `App.css`). Light overrides via `:root[data-theme="light"]`.
- **Aesthetic**: glassmorphism (backdrop-blur, semi-transparent panels), gradient accents (green→cyan→purple, see `--grad-brand`), conic-gradient glow rings on hero elements, scale-up + fade animations on modals. Match the established Login.tsx vibe.
- **Modals**: render via `createPortal(..., document.body)` to escape the `.content` stacking context. Close on Esc + backdrop click + X button. Lock body scroll while open.
- **Password fields**: always pair with a 👁️/🙈 eye toggle (pattern from Login.tsx).
- **Dropdowns**: prefer custom-styled dropdowns over native `<select>` for primary fields. Reuse the `StationDropdown` shape from `Employees.tsx` (keyboard nav, click-outside-close, panel with hover/active states).
- **File uploads**: offer two buttons — «📁 Загрузить файл» (file picker) and «📷 Сфотографировать» (`<input capture="environment">` for mobile camera).
- **Destructive actions**: `window.confirm` with clear Russian message stating consequences. Hard delete cascade-removes related User account + files.
- **Authentication**: TokenAuth only. Owner is `is_staff=True`. Employees are `is_staff=False` and get 403 on every business endpoint (until role-based access is built — Out of Scope).
- **Image validation**: server-side enforced (size ≤5MB, MIME jpeg/png, ext jpg/jpeg/png, Pillow `.verify()`). Client-side checks are UX only.
- **Telegram ID**: required and unique-with-null. Used by the bot to identify which employee sent a report. CRM does NOT send messages to employees.
- **Employee required fields** (form-level): `full_name`, `username`, `new_password`. Everything else optional.

## Architecture invariants — do NOT break

- **`Employee.user` is OneToOne PROTECT, nullable**. Deleting User cascade-deletes never happens; instead our `EmployeeViewSet.destroy` explicitly deletes Employee first, then User, inside a transaction.
- **`DailyReport.employee` is FK PROTECT**. Employees with reports cannot be deleted — return 400 with a clear message.
- **Passwords**: NEVER serialized in any response. `write_only=True` on `new_password`. Verified via `findstr /I password` on JSON dumps.
- **Username**: immutable after create. Serializer rejects it on PATCH.
- **Password rotation**: ONLY via `POST /api/employees/<id>/reset-password/`. The general PATCH endpoint rejects `new_password` with 400. Reset-password endpoint also deletes existing Token rows to force re-login.
- **Passport files**: served via auth-gated `GET /api/employees/<id>/passport/<front|back>/`, NOT via raw `/media/`. Serializer's `to_representation` rewrites URLs.
- **All ViewSets have `permission_classes = [IsAdminUser]`** (Station, Employee, FuelType, Delivery, DailyReport). Bot bypasses this — it uses Django ORM directly.
- **Telegram bot at `backend/bot/`** uses Django ORM directly (`Employee.objects...`, `DailyReport.objects.create(...)`). Does NOT call the HTTP API. So permission changes on the API do not affect the bot.
- **`station_name` serializer field** has `allow_null=True, default=None` because `station` is nullable.

## File map

Backend:
- `backend/app/models.py` — Station, Employee, FuelType, Delivery, DailyReport, ReportItem
- `backend/app/serializers.py` — DRF serializers
- `backend/app/views.py` — ViewSets + reset_password action + passport_file view
- `backend/app/urls.py` — `/api/auth/login/`, `/api/employees/<pk>/passport/<which>/`, router for ViewSets
- `backend/app/auth_views.py` — LoginView (DRF ObtainAuthToken, AllowAny)
- `backend/app/admin.py` — Django admin registrations
- `backend/config/settings.py` — settings; reads `.env` for SECRET_KEY/DEBUG/DATABASE_URL/CORS_ALLOWED_ORIGINS
- `backend/bot/` — aiogram Telegram bot (uses ORM directly)

Frontend:
- `frontend/src/App.tsx` — router
- `frontend/src/App.css` — global styles, CSS variables, theme overrides
- `frontend/src/components/Layout.tsx` — shell with Header + Sidebar + Outlet
- `frontend/src/components/Sidebar.tsx` — nav (Дашборд, Отчёты, Склад/Привоз, Управление, Настройка)
- `frontend/src/pages/Login.tsx` — public login page
- `frontend/src/pages/Management.tsx` — card grid (Сотрудники, АЗС/виды топлива/доступ как «Скоро»)
- `frontend/src/pages/Employees.tsx` — list + create/edit modal + reset-password + delete
- `frontend/src/api/client.ts` — axios instance, Token interceptor, TS types
- `frontend/src/hooks/useTheme.ts` — light/dark toggle

## Common commands

```powershell
# Migrations
cd backend; .\venv\Scripts\Activate.ps1
python manage.py makemigrations app
python manage.py migrate

# Reset a password from CLI
python manage.py changepassword <username>

# Clean DB of test rows
python manage.py shell -c "from django.contrib.auth.models import User; User.objects.filter(username__startswith='test_').delete()"

# TS check
cd frontend; npx tsc --noEmit
```

## Known follow-ups before prod (NOT blocking dev work)

- Nginx must `return 403` on `/media/passports/` (or auth_request to Django).
- Add `X-Content-Type-Options: nosniff` + `Content-Disposition: inline` on `passport_file` response.
- Rate-limit `/api/auth/login/` (DRF ScopedRateThrottle).
- Add a server-side logout endpoint that deletes the calling user's Token.
- Fail-closed on startup if `DEBUG=False` and `SECRET_KEY` starts with `django-insecure-`.
- Audit log for reset_password, is_active toggle, login success/failure.
- Role-based UI: what does a logged-in employee (is_staff=False) actually see in the SPA? Currently nothing — every endpoint 403s.
- Translate Django password validator messages to Russian.
- `Employee.__str__` shows "None" for stations-less employees.
