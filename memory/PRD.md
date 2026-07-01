# SlotNow Web — Product Requirements & Progress

## Problem Statement (original)
Build a web version of SlotNow, a booking app. The backend and MongoDB already exist at https://pro-booking-21.emergent.host. Configure this web app to call that backend URL. Replicate the booking flows from the referenced Expo app (repo was private → agreed to proceed using deployed backend API spec only).

## Architecture
- **Type:** Frontend-only web SPA (React 19 + CRA/craco + Tailwind + React Router 7)
- **Backend:** External, already deployed at `https://pro-booking-21.emergent.host` (FastAPI + MongoDB Atlas).
- **API Base:** `REACT_APP_API_URL=https://pro-booking-21.emergent.host` in `/app/frontend/.env`; axios client at `src/lib/api.js`.
- **No local backend service is used.** MongoDB is accessed via deployed backend only (per user's request).

## User personas
1. **Customer (role=customer)** — Browses categories, books slots, tracks token, leaves reviews. This is the only role implemented for the web app.
2. Provider / Admin roles are supported by the backend but not surfaced in the web UI (out of scope for v1).

## Core Requirements
- OTP-based phone auth (`+91`, 10-digit phone, 6-digit OTP). Demo OTP `123456` shown as hint when backend returns `demo_otp`.
- Category browsing (7 categories: Healthcare, Salon, Tutor, Consultant, Coach, Home Service, Automobile) with bilingual EN/HI labels.
- Provider directory: list + detail (bio, services, reviews).
- Booking flow: service → date → time → notes → confirm. Backend auto-assigns token number.
- My Bookings: upcoming vs past, with status badges.
- Live booking detail: large token number, live queue position (polled every 15s), cancel, review (post-completion).
- Notifications inbox (mark as read).
- Profile editing (name, email, city, address, language) & logout.
- Route protection: unauthenticated users are redirected to `/login`.

## Design System (see `/app/design_guidelines.json`)
- Theme: Light, earthy — cream `#F9F8F6`, forest green `#2C3E35` primary.
- Typography: Outfit (headings), Manrope (body), Noto Sans Devanagari (Hindi labels).
- Mobile-first (max-w-md container), floating pill bottom nav (raised above the Emergent badge).
- Icons: lucide-react.

## What's been implemented (2026-01)
- [x] Auth: OTP send + verify, JWT persisted in localStorage, axios interceptor with 401 auto-logout.
- [x] Home screen: greeting, search, category grid (bilingual + accent color rings), Top Rated + All Providers.
- [x] Category page (`/category/:id`): header banner + provider list.
- [x] Provider detail (`/provider/:id`): hero image with floating info card, bio, services, reviews, sticky Book CTA.
- [x] Booking flow (`/book/:providerId`): service picker → 14-day date rail → time grid derived from shifts + service duration → notes → confirm.
- [x] My Bookings (`/bookings`): upcoming/past tabs, empty states.
- [x] Booking detail (`/bookings/:id`): live token card w/ pulsing dot + queue position polling, cancel button, review form for completed bookings.
- [x] Notifications (`/notifications`): list + tap-to-mark-read.
- [x] Profile (`/profile`): editable form + logout confirmation.
- [x] Floating bottom nav (Home / Bookings / Alerts / Profile) — repositioned above Emergent badge to avoid overlap.
- [x] Route protection via `<RequireAuth>`.
- [x] E2E frontend testing pass: 12/12 flows functional (see `/app/test_reports/iteration_1.json`).

## Backlog / Not implemented (P1-P2)
- **P1:** Provider self-onboarding & dashboard (create profile, manage services, availability, view today's queue).
- **P1:** PIN-based re-login (backend supports `/auth/set-pin` + `/auth/pin-login`; UI not yet built).
- **P2:** Referral flow (backend supports `via_referral` + `ref` on OTP verify).
- **P2:** Admin console (approvals, stats, SMS/payment settings).
- **P2:** Reschedule booking (`PUT /api/bookings/{id}` supports date/start_time updates; UI only exposes cancel).
- **P2:** Push notifications / websocket live queue updates (currently 15s polling).
- **P2:** Multi-language (i18n) — currently only Hindi labels in categories; full app translation pending.
- **P2:** Vehicle-service fields for Automobile bookings (`vehicle_reg_no`, `vehicle_model`) — not yet surfaced in the UI.
- **P2:** Image upload for user avatar & provider profile.

## Deployment/config notes
- `REACT_APP_API_URL` in `/app/frontend/.env` points to the deployed backend. Do NOT change `REACT_APP_BACKEND_URL` (kept for platform compatibility).
- The local `backend/` service is not used by this web app but remains present in the repo scaffolding.
- Fonts loaded via Google Fonts in `public/index.html`.
