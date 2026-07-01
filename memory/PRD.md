# SlotNow Web — Product Requirements & Progress

## Problem Statement (original)
Build a web version of SlotNow, a booking app. The backend and MongoDB already exist at https://pro-booking-21.emergent.host. Configure this web app to call that backend URL. Replicate the booking flows from the referenced Expo app (repo private → agreed to proceed using deployed backend API spec only).

## Architecture
- **Type:** Frontend-only web SPA (React 19 + CRA/craco + Tailwind + React Router 7)
- **Backend:** External, deployed at `https://pro-booking-21.emergent.host` (FastAPI + MongoDB Atlas).
- **API Base:** `REACT_APP_API_URL=https://pro-booking-21.emergent.host` in `/app/frontend/.env`; axios client at `src/lib/api.js`.
- **No local backend used.** MongoDB accessed only via deployed backend.
- **No websockets available on backend** → SlotNow uses page-visibility-aware polling every 4s for live queue updates.

## User personas
1. **Customer** — browses categories, books slots, tracks token, reviews, reschedules.
2. **Provider** — self-onboards, manages services & availability, runs today's queue (call-next / walk-in / reset).

## Design System (see `/app/design_guidelines.json`)
- Cream `#F9F8F6` background, forest `#2C3E35` primary.
- Outfit (headings) + Manrope (body) + Noto Sans Devanagari (Hindi).
- Mobile-first (max-w-md container), floating pill bottom nav (bottom-[76px]) above the Emergent badge.
- Icons: lucide-react.

## What's implemented (2026-01)

### Iteration 1 — Customer MVP
- [x] OTP auth (send/verify), JWT persistence, axios 401 auto-logout.
- [x] Home: greeting, search, category grid (bilingual), Top Rated + All Providers.
- [x] Category page & Provider detail (hero, bio, services, reviews, sticky Book CTA).
- [x] Booking flow: service / date / time / notes / confirm → token.
- [x] My Bookings: upcoming / past tabs.
- [x] Booking detail: live token, queue position, cancel, review.
- [x] Notifications inbox.
- [x] Profile: editable form + logout.
- [x] Role-agnostic bottom nav + route protection.

### Iteration 2 — Provider suite, PIN, reschedule, i18n, live polling
- [x] **Provider self-onboarding** (`/provider/onboarding`) → dashboard (`/provider`).
- [x] **Provider dashboard**: profile card, duty toggle, today's stats, service/availability/capacity/queue quick links.
- [x] **Provider services CRUD** (`/provider/services`) with service_type field.
- [x] **Provider availability CRUD** (`/provider/availability`) per weekday.
- [x] **Provider queue** (`/provider/queue`) — live-polled every 4s, page-visibility aware. Call-next, Walk-in modal (with vehicle fields), Reset.
- [x] **Role-aware bottom nav** (customer: Home/Bookings/Alerts/Profile ; provider: Dashboard/Queue/Alerts/Profile).
- [x] **Route protection with role** (customer→/, provider→/provider).
- [x] **PIN-based re-login**: `Login with PIN` mode on the login screen; set-PIN prompt after first OTP verify; Change/Set PIN in Profile.
- [x] **Booking reschedule**: modal from booking detail — date rail + time grid + PUT `/bookings/{id}`.
- [x] **Full i18n (EN + Hindi)** — dictionary covers Login, Home, Category, Provider Detail, Booking flow, My Bookings, Booking Detail, Notifications, Profile, Provider onboarding, Dashboard, Services, Availability, Queue.
- [x] **Automobile-specific fields** — when `category_id === '333a2602-2d4a-4e16-a9da-3e004b0e14fd'`, Book Slot shows Vehicle Reg No (required), Model, Service Type. Walk-in modal also has vehicle fields.
- [x] **Live queue polling** via `useLivePolling(fn, 4000)` — page-visibility aware, pauses when tab hidden.
- [x] Modals repositioned to avoid Emergent badge overlap (pb-24 sm:pb-4).

## Test coverage
- Iteration 1: 12/12 customer flows pass.
- Iteration 3 (retest): 6/7 iteration-2 flows fully verified (86%). Automobile end-to-end partially blocked because seeded Automobile provider has no availability slots (backend seed gap, not a UI bug). All UI code paths verified working.

## Backlog / Not implemented (P2)
- Admin console (approvals, stats, SMS/payment settings).
- Referral flow (`via_referral` + `ref` on OTP verify).
- Avatar & provider image uploads.
- Real websockets when backend supports them.
- Emergent-managed Google Auth (not requested).

## Notes / Constraints
- Backend has no websocket. "Live" queue is smart 4s polling (visibility-aware).
- Automobile provider needs availability seeded to fully test the vehicle-reg required flow end-to-end.
- ProviderOnboarding category `<option>` renders `name / name_hi` as plain text (no wrapping element).
- PIN login returns user to the pre-login route (same behavior as OTP verify) — matches standard React auth UX.
