# SlotNow Web — Product Requirements & Progress

## Problem Statement (original)
Build a web version of SlotNow, a booking app. Backend + MongoDB deployed at https://pro-booking-21.emergent.host. Frontend-only web app calls that API.

## Architecture
- React 19 + CRA/craco + Tailwind + React Router 7.
- Backend external (`REACT_APP_API_URL=https://pro-booking-21.emergent.host`). No local backend.
- No websockets → 4s visibility-aware polling for live queue.
- Booking is SHIFT-based (`start_time == shift.start_time`).

## Roles (4)
1. **Customer** — browse, book, reschedule, review, refer.
2. **Service Provider** — self-onboard, manage services + availability + capacity + assistants, run queue, view/delete history.
3. **Service Assistant** (backend: `receptionist`) — provider-created; runs the same queue on behalf of the provider; view history (no delete).
4. **Admin** — approve/reject providers (single + bulk), users, bookings, revenue, SMS/payment settings, referral tracking.

## Design System (matches mobile app)
- Navy `#1E3A8A` (forest) + Orange `#F97316` (accent) + cream `#F5F6F8` + ink `#1D2E5B`.
- Custom SVG logo (blue clock + orange checkmark tail); navy "Slot" + orange "Now" wordmark.
- Outfit (headings) + Manrope (body) + Noto Sans Devanagari (Hindi).
- Mobile-first max-w-md container, floating pill bottom-nav, orange primary CTAs.

## What's implemented (all iterations)

### Iterations 1-7 (previous)
- Customer flow (categories, providers, booking, live token, bookings, notifications, profile).
- Provider onboarding + dashboard + services + availability + queue + assistants.
- Service Assistant dashboard (linked-provider queue).
- Admin dashboard (users, bookings, revenue, SMS + payment settings, provider approval).
- Full i18n (EN + हिं).
- PIN re-login, booking reschedule, automobile vehicle fields.
- Shift-based bookings + QuickWheels seeded.

### Iteration 8 (new)
- **History page** (`/provider/history` + `/receptionist/history`) — date-range picker with 0/7/30/90-day presets, 4 mini-stats, Print via window.print(), per-row **Call** (tel:) + **WhatsApp** (wa.me deep link with pre-filled message) + **Delete** (Provider role only).
- **Walk-in Paid/Free** — segmented control added to walk-in modals in ProviderQueue AND ReceptionistDashboard.
- **Referral tracking** —
  - `?ref=<phone>` captured on Login; sessionStorage persists across form steps.
  - verify-otp sends `{ via_referral: true, ref: <phone> }` when ref present.
  - Customer Profile shows orange "Refer & Share" gradient card with copyable link + Web Share (falls back to copy).
  - `/admin/referrals` — ranked list (top 3 with trophy) grouped by `referred_by`, showing total refs + converted (has booking) + individual referred phones. Aggregation over `/admin/users` + `/admin/bookings`.
- **Two-line shift card** — BookSlot shift cards now render `9:00 AM – 6:00 PM` / `N booked so far` / `Token on confirm` on three stacked lines with active checkmark on right.
- **Business image URL live preview** — ProviderOnboarding image field shows 80×80 preview below the input.
- **Bulk approve** — Admin dashboard shows `Approve all (N)` button next to the "Pending Approval" badge when N ≥ 1. Sequentially calls `/admin/providers/{id}/approve`. Confirmed working with 4 pending providers seeded in DB.
- Bugfix: Admin dashboard now correctly reads `approved: boolean` (was reading `status: 'pending'`).

## Test coverage
- Iteration 1: 12/12 customer.
- Iteration 4: 13/14 — roles + design.
- Iteration 7: 4/4 (100%) — Automobile end-to-end.
- Iteration 8: 11/12 verified + 12th code-verified (bulk approve DB-gated). After seeding 4 pending providers + admin filter fix, bulk approve is UI-verified working ("Approve all (4)" visible).

## Backlog (P2)
- Real WebSocket-based live queue.
- Native image upload API (currently URL-based).
- Provider avatar upload.
- Emergent-managed Google Auth.
- Referral rewards (credit ledger for referrer).

## Notes / Constraints
- Backend uses `receptionist` internally for Service Assistant.
- Backend has no dedicated referral endpoints — tracking is captured via `via_referral` + `ref` on OTP verify, and aggregated client-side in `/admin/referrals`.
- Delete permissions in History are enforced client-side (assistants don't see the button); backend also enforces via the API.
