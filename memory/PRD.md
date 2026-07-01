# SlotNow Web — Product Requirements & Progress

## Architecture
- React 19 + CRA/craco + Tailwind + React Router 7.
- Backend external at `https://pro-booking-21.emergent.host` (no local backend).
- Booking is SHIFT-based (`start_time == shift.start_time`).
- No websockets → 4s visibility-aware polling.

## Roles (4)
1. **Customer** — browse, book, reschedule, review, refer (with rewards).
2. **Service Provider** — self-onboard (with image upload), services + availability + capacity + assistants, queue, history w/ delete.
3. **Service Assistant** (backend: `receptionist`) — linked-provider queue, walk-ins (with vehicle model), history w/o delete.
4. **Admin** — approve providers (single + bulk), users, bookings, revenue, SMS+payment settings, referral tracking.

## Design (matches mobile app)
- Navy `#1E3A8A` + Orange `#F97316` + cream `#F5F6F8`.
- Custom SVG logo (blue clock + orange checkmark).
- Outfit + Manrope + Noto Sans Devanagari.

## All shipped features

### Iterations 1–7 — Core + roles + design
Customer flow, provider suite, receptionist suite, admin suite, i18n (EN + हिं), PIN re-login, reschedule, automobile vehicle fields, shift-based booking, live polling.

### Iteration 8 — History + walk-in Paid/Free + referral + polish
History page (Provider + Assistant) with Call/WhatsApp/Print + Provider-only Delete. Walk-in Paid/Free segmented control (Provider + Receptionist). Referral tracking via `?ref=`, Admin `/admin/referrals` aggregation. Two-line shift card. Bulk-approve. Image URL preview.

### Iteration 9 — Bugfix + 3 P2 enhancements (100% pass)
- **BUG FIX**: `rec-walkin-model` — added Vehicle Model input to Receptionist walk-in modal (was missing, blocking automobile walk-in bookings).
- **Native image upload**: ProviderOnboarding now has an `Upload image` button that reads any local image file, compresses it (max 800px, JPEG q=0.75) to a base64 data URL via `compressImageToDataURL` helper, and stores it in the profile. Preview + Clear button included. URL paste still supported as fallback.
- **Force onboarding for empty profile**: `Login.homeForRole` now checks both `/providers/me/profile` 404 AND empty `business_name` → routes to `/provider/onboarding`. Verified: brand-new provider phone 8782913356 lands on onboarding, not dashboard.
- **Referral rewards progress**: Customer Profile Refer & Share card now shows a 3-tier progress bar (1 = ₹50 credit, 3 = ₹200 booking, 10 = priority support). Tries `GET /api/referrals/mine` for live count, falls back to 0 gracefully when backend doesn't expose the endpoint (currently 404s).

## Test coverage summary
- Iteration 1: 12/12 customer.
- Iteration 4: 13/14 — roles + design.
- Iteration 7: 4/4 (100%) — Automobile end-to-end.
- Iteration 8: 11/12 + UI-verified bulk approve.
- **Iteration 9: 6/6 (100%)** — all P2 items + bug fix verified.

## Open Backend Recommendations (for backend team)
- Implement `GET /api/referrals/mine` returning `{ count: N }` (or add `total_refs` to `/users/me`) so the Profile progress bar shows live counts. Currently 404s; UI handles gracefully.
- Consider a real image upload endpoint (multipart) or return a signed URL. Current approach stores base64 in Mongo which may bloat documents; fine for MVP but a proper media service would be cleaner.
- Consider explicit `approved: false` on freshly-onboarded providers so they enter the admin approval funnel.

## Backlog (P2/P3)
- Real WebSocket-based live queue.
- Emergent-managed Google Auth.
- Provider avatar upload (currently business image only).
- Referral rewards ledger (backend needs schema + rules).

## Test credentials
- Customer: `9999999999` / OTP `123456` / PIN `1234`
- Provider (onboarded): `8888800884` / OTP `123456`
- Provider (QuickWheels, Automobile, approved): `8888800002` / OTP `123456`
- Service Assistant: `6666600011` / OTP `123456`
- Admin: `7777700002` / OTP `123456`
- Fresh provider (parked on onboarding): `8782913356` / OTP `123456`
- Pending providers for bulk-approve demo: `91111001`, `91111002`, `91111003`
