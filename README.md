# QR-MENU

**Restaurant QR Menu SaaS · Expo / React Native / FastAPI / MongoDB**

QR-MENU is a full-stack restaurant menu and table-service application. Administrators manage branches, tables, menus, and staff. Guests open a table-specific QR link to browse, submit an order, or call a waiter. Authenticated staff track orders and acknowledge calls.

**Status: advanced MVP, in development.** Application flows and API integration tests are present. This is not a claim of production-hardened SaaS readiness.

## Implemented features

| Area | Current implementation |
| --- | --- |
| Restaurants | Registration creates a tenant and administrator; authenticated data access uses tenant IDs |
| Authentication | Email/password login, bcrypt hashes, HS256 JWT bearer tokens with a 30-day expiry, active-user lookup |
| Roles | Server-side `admin` and `staff` access checks |
| Branches | Branch management and restaurant/branch ordering switches |
| Tables / QR | Branch tables with QR tokens; frontend QR rendering and link copying |
| Menu | Categories, multilingual names/descriptions, prices, images, availability, visibility, sizes, addons |
| Offers | Branch-specific multilingual offers with active/inactive state |
| Orders | Table-associated guest orders with quantities, options, notes, and status lookup |
| Statuses | `new`, `preparing`, `ready`, `completed`, `cancelled` |
| Waiter calls | Table-specific calls, reuse of pending calls, staff acknowledgement |
| Operations | Dashboard, polling-based live view, change logs for selected mutations |
| Media | Upload/retrieval through an external object-storage integration when configured |

Offers are menu content, not a checkout-discount engine. Payment checkout and subscription billing are not implemented.

## Roles

- **Admin:** restaurant settings, staff, branches, tables, categories, items, offers, uploads, and change logs; also operational access.
- **Staff:** authenticated operational reads, dashboard, order-status changes, and waiter-call acknowledgement. Menu management endpoints require an admin.
- **Guest:** public menu, order submission, waiter call, and order-status lookup without an account.

## Architecture and stack

```text
Expo / React Native + Expo Router
  ├─ authenticated administration and operations
  └─ public /m/[token] menu
          │ HTTP /api/*
FastAPI + Pydantic + JWT / bcrypt
          ├─ Motor → MongoDB
          └─ external object-storage API
```

- **Frontend:** TypeScript, React 19, React Native 0.81, Expo SDK 54, React Native Web, QR SVG rendering, and platform-specific storage helpers.
- **Backend:** Python, FastAPI, Pydantic, PyJWT, bcrypt, Motor/PyMongo, python-dotenv.
- **Tests:** pytest, pytest-xdist, requests-based integration tests against a running API.

## Local setup

### Prerequisites

Python 3.10+ with an isolated environment, a running MongoDB instance, Node.js, and Yarn Classic 1.22.22. Check dependency compatibility with your selected Python version. Native targets also require their Android/iOS development tools.

```bash
git clone https://github.com/nael5x/QR-MENU.git
cd QR-MENU/backend
python -m venv .venv
```

Activate with `.venv\Scripts\Activate.ps1` on Windows PowerShell or `source .venv/bin/activate` on macOS/Linux:

```bash
python -m pip install -r requirements.txt
```

The requirements include the environment-specific `emergentintegrations==0.2.0`. If your package index cannot resolve it, dependency setup requires attention; a partial installation is not a verified environment.

### Backend environment

Create an untracked `backend/.env`:

```dotenv
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=qr_menu_local
JWT_SECRET=replace-with-a-long-random-local-secret
```

Generate a local secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Never commit the real value.

| Variable | Purpose |
| --- | --- |
| `MONGO_URL` | Required MongoDB connection |
| `DB_NAME` | Required database name |
| `JWT_SECRET` | Required JWT signing secret |
| `EMERGENT_LLM_KEY` | Optional credential used to initialize object storage; needed for media operations |
| `INTEGRATION_PROXY_URL` | Optional integration base URL; defaults to the provider in `server.py` |

From `backend/`:

```bash
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

API root: `http://127.0.0.1:8000/api/`. Interactive docs: `http://127.0.0.1:8000/docs`. Menu/order workflows do not require uploads; media operations need storage configuration.

Startup automatically seeds a demo tenant if `admin@demo.com` is absent. Local demo accounts are `admin@demo.com` and `staff@demo.com`, both with password `demo1234`; table token: `demo-table-1`. These are public development credentials. Automatic seeding must be changed before public deployment.

### Frontend environment

Create `frontend/.env`:

```dotenv
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

Do not append `/api`; the API helper adds it. From `frontend/`:

```bash
yarn install --frozen-lockfile
yarn web
```

Open the URL Expo prints. Other scripts: `yarn start`, `yarn android`, `yarn ios`. The package has a shell-style preinstall hook; Windows may require a POSIX-compatible shell/WSL if it cannot execute directly.

**QR routing:** generated links currently use `EXPO_PUBLIC_BACKEND_URL` plus `/m/<token>`, but `/m/[token]` belongs to the frontend. When local ports differ, open `/m/demo-table-1` on the **Expo web origin** manually. Generated scannable links require a shared origin/reverse proxy routing `/api/*` to FastAPI and `/m/*` to the frontend, or a later frontend-origin configuration change. A phone needs a reachable LAN/host URL; its own loopback address is not your development computer.

## Tests

Use a disposable local database: suites create, update, and delete records and expect demo seed data. Start the backend, then from `backend/`:

```bash
# macOS/Linux
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 python -m pytest tests -q
```

```powershell
# Windows PowerShell
$env:EXPO_PUBLIC_BACKEND_URL = "http://127.0.0.1:8000"
python -m pytest tests -q
```

`EXPO_BACKEND_URL` is the tests' fallback variable. `pytest.ini` requires pytest-xdist and two workers with `loadscope`; retain that configuration.

- `backend/tests/backend_test.py`: auth, role restrictions, tenant isolation, branches, tables, menus, and logs.
- `backend/tests/test_phase23.py`: orders, offers, sizes/addons, availability, waiter calls, live data. Some assertions describe intended behavior and can expose implementation gaps.
- Frontend check: `yarn lint`.
- `test_reports/` contains historical output, not proof that this checkout passes.

## Current limitations

- Orders use client-supplied `unit_price`, names, and options. Authoritative server-side pricing and branch/option validation need work before real transactions.
- Listed order statuses are accepted, but a complete status-transition workflow is not enforced.
- Automatic demo seeding, permissive CORS, public ordering/call endpoints, and abuse protection need deployment review.
- QR origin configuration and external storage depend on deployment setup.
- Payment processing, subscriptions, and production deployment/monitoring are not implemented claims.

## Source map

- `backend/server.py`: API, models, auth, storage, demo seed.
- `backend/tests/`: HTTP integration tests.
- `frontend/app/`: administration, operations, and public menu routes.
- `frontend/src/`: API, auth, translations, polling, and storage.
- `test_reports/`: historical test output.
- `memory/PRD.md`: product notes.
