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

### Iteration 10 — WhatsApp + Calling + DnD + Admin controls (100% pass, Feb 2026)
- **WhatsApp deep link + templates**: New `WhatsAppModal` (`/app/frontend/src/components/WhatsAppModal.jsx`) with 4 pre-filled templates (Confirmation, Reminder, Follow-up, Referral Invite) plus Manual. `waLink(phone, text)` builds `https://wa.me/91<phone>?text=<encoded>`. Uses `window.location.origin` for the invite URL (no hardcoded preview host).
- **Call deep link**: `tel:+91<phone>` button next to WhatsApp on every queue row and history row.
- **Drag-and-drop queue reorder (Receptionist)**: `@dnd-kit/core` + `@dnd-kit/sortable` on `ReceptionistDashboard`. Drop → POST `/api/queue/reorder` with `{ date: todayISO(), ordered_ids }`. Uses local (not UTC) date via `todayISO()` in `utils-app.js` to avoid the IST off-by-one after midnight IST.
- **Reusable QueueRow**: `/app/frontend/src/components/QueueRow.jsx` — used by both Provider Queue and Receptionist Dashboard. Provider queue intentionally does NOT render drag handles (drag_handles=0) — reorder is receptionist-only.
- **Admin Suspend/Unsuspend + Approve/Reject**: `AdminDashboard` gains suspend/unsuspend buttons on approved providers (currently maps to reject endpoint pending a dedicated backend endpoint — captured in Open Backend Recommendations).
- Test IDs added: `wa-modal`, `wa-option-{k}`, `wa-manual-input`, `wa-preview`, `wa-send-btn`, `queue-drag-<id>`, `queue-call-<id>`, `queue-wa-<id>`, `history-whatsapp-<id>`, `history-call-<id>`, `admin-suspend-<id>`, `admin-unsuspend-<id>`, `admin-approve-<id>`, `admin-reject-<id>`, `admin-bulk-approve-btn`.

## Test coverage summary
- Iteration 1: 12/12 customer.
- Iteration 4: 13/14 — roles + design.
- Iteration 7: 4/4 (100%) — Automobile end-to-end.
- Iteration 8: 11/12 + UI-verified bulk approve.
- Iteration 9: 6/6 (100%) — all P2 items + bug fix verified.
- Iteration 10: 100% — WhatsApp + Call + DnD + Admin controls; only 2 non-blocking design nits.
- Iteration 11: 100% — post-fix verification of `todayISO()` local-date + WhatsApp `window.location.origin` invite.
- Iteration 12: 100% — code-quality refactor sweep (hook deps, empty catches, useMemo, stable keys). Zero regressions.
- Iteration 13: 6 user-reported bugs fixed — schedule date (nextNDays local), ↑/↓ arrow buttons on receptionist queue, patient-history modal on row click, on-time alert on BookingDetail, walk-in conditional fields, Get Directions link. Surfaced 2 backend gaps.
- Iteration 13: 6 user-reported bugs fixed — schedule date (nextNDays local), ↑/↓ arrow buttons on receptionist queue, patient-history modal on row click, on-time alert on BookingDetail, walk-in conditional fields, Get Directions link. Surfaced 2 backend gaps.
- Iteration 14: 100% — workarounds for the 2 backend gaps (position derived from `qp.wait`, map link co-stored in address).
- **Iteration 15: 5/5 PASS** — mobile-app parity round: (1) weekday convention bridge JS↔Python fixes "schedule shifts to next day", (2) LocationPickerModal for provider onboarding (Use current location / Open Google Maps / paste), (3) Automobile branch on walk-in modal now uses `providerInfo.category` string (not category_id), (4) non-auto uniformity preserved, (5) HistoryPage rows now open PatientHistoryModal on name click.
- **Iteration 16: 5/5 PASS** — LocationPickerModal geolocation UX overhaul. Root cause of "Location permission denied" on Android was Emergent's chat preview loading the app in a cross-origin iframe without `allow="geolocation"`. Fixes: iframe detection with proactive amber notice + "Open in a new tab" button, Permissions API preflight, retry-with-lower-accuracy on TIMEOUT, 5 distinct `data-error-kind` classifications (iframe/denied/unavailable/timeout/other) each with actionable copy.

## Open Backend Recommendations (for backend team)
- **[NEW – would let us remove a workaround] Weekday convention on `Provider.availability`**: the backend stores/reads weekday using Python's `datetime.weekday()` convention (0=Mon..6=Sun). The web frontend uses JS `getDay()` (0=Sun..6=Sat), so we now bridge with `jsToPyWeekday()`/`pyToJsWeekday()` in ProviderAvailability.jsx. If the backend is ever migrated to a shared 0=Sun..6=Sat convention (matching mobile clients / most calendar APIs), both helpers can be deleted together.
- **[NEW – would let us remove a workaround] `/queue/today` provider serialization**: currently returns `provider.category` as a display STRING (e.g. "Automobile") instead of `provider.category_id`. The web frontend now string-matches "automobile" to decide whether to show the vehicle walk-in branch, which is fragile against localization. Please add `category_id` to the response.
- **[NEW – would let us remove a workaround] `GET /api/queue/my-position`**: (a) add an explicit `position` integer (count of active tokens strictly ahead of the caller), (b) honor the `provider_id` and `date` query params — currently the endpoint returns the caller's next active booking globally, so a customer viewing a *non-first* active booking gets misleading data. Frontend workaround (iteration 14): derive `position = qp.wait` and only trust the response when `qp.booking.id === viewed booking id`.
- **[NEW – would let us remove a workaround] `Provider.location_link`**: add a dedicated string column so we can stop piggy-backing the Google Maps link inside `address`. Frontend workaround (iteration 14): `packAddress(text, url) → "<text>\n\n📍 <url>"`, `unpackAddress()` on read.
- **[Security] Migrate auth token storage to httpOnly cookies.** The web frontend currently stores JWT in `localStorage` because the deployed backend returns `{ token }` in JSON. localStorage is XSS-exposed. Backend must (a) issue the JWT via `Set-Cookie: HttpOnly; Secure; SameSite=Lax` on `/api/auth/verify-otp` and `/api/auth/pin-login`, (b) accept the cookie on subsequent requests, (c) add a `/api/auth/logout` that clears the cookie, and (d) enable CORS `credentials: true`.
- Add a dedicated `PUT /api/admin/providers/{id}/suspend` (+ `/unsuspend`) endpoint. Currently Suspend reuses `/reject`, which is semantically fragile.
- Implement `GET /api/referrals/mine` returning `{ count: N }` (or add `total_refs` to `/users/me`) so the Profile progress bar shows live counts. Currently 404s; UI handles gracefully.
- Consider a real image upload endpoint (multipart) or return a signed URL. Current approach stores base64 in Mongo which may bloat documents; fine for MVP but a proper media service would be cleaner.
- Consider explicit `approved: false` on freshly-onboarded providers so they enter the admin approval funnel.
- Seed a receptionist account linked to an Automobile provider so the vehicle-fields walk-in branch can be validated live (currently the sole receptionist is linked to a Healthcare provider, so the auto branch remains code + route-intercept verified only).

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
