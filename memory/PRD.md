# PRD — منصة منيو QR متعددة المطاعم (Multi-Restaurant QR Menu SaaS)

## Original Problem Statement
Multi-restaurant QR-menu SaaS. Each restaurant has an independent account; can create branches, tables, and per-table QR codes; multi-language menus; table ordering; waiter call; order status tracking; ratings; reservations; offers; notifications. Admin mobile app + ultra-light customer web (opens on QR scan, no e-payment). Arabic/RTL first, high performance.

## User-Selected Scope (this build = MVP / Phase 1)
- Restaurant account + branches/tables/QR + multi-language menu + lightweight customer web menu.
- Auth: email + password (JWT). Roles: admin + staff (staff = receive orders / update status only — no orders module in MVP yet).
- Notifications: Push (deferred — requires native build + ordering module; infra to be added with Phase 3).
- Design: chosen by agent → Brutalist Light, brand orange #FF5500, IBM Plex Sans Arabic, full RTL.

## Architecture
- Frontend: Expo Router (React Native + RN Web). Admin app in `app/(auth)` + `app/(tabs)`; customer web menu standalone at `app/m/[token].tsx`.
- Backend: FastAPI + Motor (MongoDB). UUID string ids (`id`), `_id` excluded from responses. JWT (pyjwt) + bcrypt.
- Storage: Emergent Managed Object Storage for menu images (`/api/upload`, `/api/files/{path}` — file serving public so customer web can load images).
- Multi-language fields stored as `{langCode: value}` dicts. Multi-tenant: every query scoped by `tenant_id` from the verified token.

## Users / Personas
- Restaurant owner/admin: full control (branches, tables, QR, menu, languages, staff, orders toggle).
- Staff: receive orders / update status only (403 on admin endpoints).
- Customer: scans QR → opens web menu, picks language, browses, can "call waiter" (local in MVP).

## Implemented (2026-08-16)
- Auth: register (creates restaurant+admin), login, me. bcrypt + JWT. Seeded demo tenant.
- Restaurant settings: name, menu languages, orders_enabled master toggle.
- Branches CRUD; Tables CRUD with unique qr_token; QR rendering (react-native-qrcode-svg) + copy link.
- Menu: categories CRUD (+ visibility), items CRUD, multi-language name/description, price, image upload, availability & visibility toggles.
- Staff management (admin). Change logs for sensitive edits (price, availability, orders/languages toggle).
- Public customer web menu `/m/{qr_token}`: restaurant/branch/table header, language switcher, categories with visible items, out-of-stock badge, orders-paused notice, call-waiter button.
- Dashboard KPIs + orders master switch. Full RTL Arabic UI, IBM Plex fonts, brutalist design.
- Tested: 31/31 backend pytest pass; frontend E2E verified.

## Backlog / Remaining
- P1 (Phase 2 depth): item add-ons/customizations UI, per-branch price/menu differences UI, offers/promotions module.
- P1 (Phase 3): table ordering, waiter-call backend + real-time admin/staff in-app notifications, order status tracking, push notifications (native build).
- P2 (Phase 4): reservations, ratings/reviews, deep performance tuning + weak-network testing, subscription/billing per restaurant.

## Test Credentials
See `/app/memory/test_credentials.md` (admin@demo.com / demo1234, staff@demo.com / demo1234, QR token `demo-table-1`).
