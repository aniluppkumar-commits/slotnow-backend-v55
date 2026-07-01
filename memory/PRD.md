# SlotNow Web — Product Requirements & Progress

## Problem Statement (original)
Build a web version of SlotNow, a booking app. The backend and MongoDB already exist at https://pro-booking-21.emergent.host. Configure this web app to call that backend URL. Replicate the booking flows from the referenced Expo app (private repo → proceeded via deployed backend API spec).

## Architecture
- **Type:** Frontend-only web SPA (React 19 + CRA/craco + Tailwind + React Router 7)
- **Backend:** External, deployed at `https://pro-booking-21.emergent.host` (FastAPI + MongoDB Atlas).
- **API Base:** `REACT_APP_API_URL=https://pro-booking-21.emergent.host` in `/app/frontend/.env`.
- **No local backend used.** MongoDB accessed only via deployed backend.
- **No websockets on backend** → SlotNow uses page-visibility-aware polling every 4s for live queue updates.
- **Booking is SHIFT-based** (not per-minute slots) — customer joins a shift session and receives a queue token.

## User personas (4 roles)
1. **Customer** — browses categories, books slots, tracks token, reviews, reschedules.
2. **Service Provider** — self-onboards, manages services / availability / capacity / assistants, runs today's queue.
3. **Service Assistant** (backend: `receptionist`) — created by a Provider; logs in and works the same queue on behalf of that provider.
4. **Admin** — approves/rejects providers, browses all users & bookings, edits SMS + payment settings, sees subscription revenue.

## Design System (matches mobile app)
- **Primary Navy** `#1E3A8A` (forest.DEFAULT) — used for headers, section labels, secondary buttons.
- **Accent Orange** `#F97316` (accent.DEFAULT) — used for primary CTAs (Continue, Book a slot, Confirm, Call next).
- **Background** cream `#F5F6F8`; white cards; ink `#1D2E5B` text.
- **Logo** — custom SVG (navy clock ring + orange checkmark tail + speed lines) rendered by `SlotNowMark`.
- **Wordmark** — navy "Slot" + orange "Now" (`SlotNowWordmark`).
- **Typography** Outfit (headings) + Manrope (body) + Noto Sans Devanagari (Hindi).
- **Mobile-first** (max-w-md container) with floating pill bottom nav (bottom-[76px]) that clears the Emergent badge.

## What's implemented (final)

### Iteration 1 — Customer MVP ✅
OTP auth, categories, providers, provider detail, booking flow, my bookings, booking detail (live token), notifications, profile, route protection.

### Iteration 2 — 6 P1 features ✅
Provider onboarding + dashboard + services CRUD + availability CRUD + queue + assistants; PIN re-login; booking reschedule; full i18n (EN + हिं); Automobile-specific fields; live 4s polling.

### Iteration 3–5 — polish & regression fixes ✅
Modal-badge overlap, `Array.isArray` guards, `<option>` template literals, provider re-login profile lookup, receptionist header shows business name.

### Iteration 6–7 — Roles + Design + Shift booking ✅
- **Admin dashboard** `/admin` + Users / Bookings / Revenue / SMS + Payment settings.
- **Service Assistant** `/receptionist` — assist dashboard with Live badge, Now-serving token, Call next, Walk-in modal.
- **Provider Assistants CRUD** `/provider/assistants` — add / block / remove.
- **Design overhaul** — new navy + orange palette, custom SlotNow SVG logo, 2×2 role tile grid on login (Customer / Service Provider / Service Assistant / Admin), language pill top-right.
- **Shift-based booking** — Book Slot and Reschedule show each availability window as a shift card ("9:00 AM – 6:00 PM · N booked so far"); backend expects `start_time == shift.start_time` so the frontend now sends exactly that.
- **QuickWheels Auto Service** seeded (Automobile category, approved, 09:00–18:00 daily) to enable full end-to-end vehicle-reg required booking.

## Test coverage
- Iteration 1: 12/12 customer flows.
- Iteration 4: 13/14 (93%) — Assistant + Admin + design added.
- Iteration 5: 5/7 — 3 blockers surfaced.
- Iteration 6: 5/7 — Automobile still blocked by duplicate seed shifts.
- **Iteration 7: 4/4 (100%)** — Automobile end-to-end passes, reschedule passes, non-auto regression passes, admin routing passes. Provider/Receptionist routing not re-run this iteration (previously verified in iteration 6, no code change).

## Backlog (P2)
- Referral flow surfacing (`via_referral` + `ref` params).
- Provider avatar & business image uploads.
- WebSocket-based live queue (drop-in replace `useLivePolling` when backend adds WS).
- Emergent-managed Google Auth (not requested).
- Bulk-approve for admin, richer revenue analytics.
- Two-line shift-card layout for very small viewports (minor UX polish flagged by testing agent).

## Notes / Constraints
- Backend has no websocket. Polling is 4s and page-visibility-aware.
- Backend booking model is shift-based; the UI now matches. Sub-minute slot picking would require backend changes.
- Iteration 7 seeded two active customer bookings (auto + non-auto) — safe to delete manually.
