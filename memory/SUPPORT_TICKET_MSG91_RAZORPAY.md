# Emergent Support Ticket — SlotNow Backend: MSG91 SMS + Razorpay Payment

## Summary
Please enable **live MSG91 OTP delivery** and **Razorpay online payments** on the deployed SlotNow backend (`https://pro-booking-21.emergent.host`). Both features have admin-panel UIs and storage endpoints in place, but the backend service itself still hits mock/demo code paths.

---

## Part 1 — MSG91 (SMS OTP)

### Current behaviour
- `GET /api/admin/settings/sms` and `PUT /api/admin/settings/sms` **work correctly** — admin can save `{ provider, api_key, sender_id, dlt_template_id, enabled }`.
- `POST /api/auth/send-otp` **ignores** the saved config and always responds with `{ "ok": true, "message": "OTP sent (demo: use 123456)", "demo_otp": "123456" }`. Every user login therefore accepts `123456` as valid OTP.

### Required changes (backend)
1. In `POST /api/auth/send-otp`:
   - **Remove** the hardcoded demo OTP fallback — it must no longer be reachable under any condition (no env flag, no query param, no debug bypass).
   - **Do NOT** return `demo_otp` in the response.
   - Read the SMS settings row from Mongo on every request.
   - If `provider == "msg91"` **and** `enabled == true` **and** `MSG91_API_KEY` env var is set:
     - Generate a random 6-digit OTP server-side.
     - Store it in the OTP collection with a short TTL (e.g. 5 min).
     - POST to MSG91:
       ```
       POST https://control.msg91.com/api/v5/flow/
       Headers:  authkey: <MSG91_API_KEY>,  Content-Type: application/json
       Body:  {
         "template_id": <dlt_template_id from DB>,
         "sender": <sender_id from DB>,
         "short_url": "0",
         "recipients": [{"mobiles": "91<phone>", "otp": "<generated_otp>"}]
       }
       ```
     - On non-200 MSG91 response, return HTTP 502 with a JSON `{"detail": "SMS provider error: <msg>"}` — do NOT fall through to demo.
   - If `enabled == false` or provider is `"mock"` in production:
     - Return HTTP 503 `{"detail": "SMS is not configured. Please contact support."}` so the client can show a proper error.
   - Ensure `POST /api/auth/verify-otp` verifies against the stored OTP (not against the literal string `123456`).

### Credentials to set as backend env vars
```
MSG91_API_KEY = 548721AMkxpXNo6T6a4e834dP1
```
Admin will fill `sender_id = SLOTNW` and `dlt_template_id = 1207178359126464853` via the Admin Panel UI (already working — verified with curl on the deployed backend).

### Acceptance criteria
- Calling `POST /api/auth/send-otp` with a real phone triggers a real SMS delivery (verifiable at msg91.com dashboard).
- Calling `POST /api/auth/verify-otp` with the wrong OTP returns 401.
- Calling either with `enabled=false` returns HTTP 503 (not demo OTP).
- `demo_otp` key removed from every response.

---

## Part 2 — Razorpay (Online Payments)

### Current behaviour
- `GET /api/admin/settings/payment` and `PUT /api/admin/settings/payment` **work correctly** — admin can save `{ provider, api_key, api_secret, webhook_secret, enabled }`.
- There is no `create-order` / `verify-payment` endpoint. The booking flow is currently free / offline-payment only.

### Required changes (backend)
1. **Env vars**:
   ```
   RAZORPAY_KEY_ID     = <provided separately by the customer>
   RAZORPAY_KEY_SECRET = <provided separately by the customer>
   ```
2. **New endpoints**:
   - `POST /api/payments/create-order`
     - Body: `{ booking_id: str }` (or `{ service_id, provider_id, amount_paise }` for pre-booking payment).
     - Server calls Razorpay `POST /v1/orders` with `amount` (in paise), `currency: "INR"`, `receipt: <booking_id>`.
     - Server stores the Razorpay order id against the booking (`bookings.rzp_order_id`).
     - Returns `{ rzp_order_id, key_id, amount, currency, name, description, prefill }` for the checkout widget.
   - `POST /api/payments/verify`
     - Body: `{ rzp_order_id, rzp_payment_id, rzp_signature, booking_id }`.
     - Server verifies the HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`. If invalid → HTTP 400.
     - On valid: update the booking to `paid=true, payment_status='captured', rzp_payment_id=...`.
     - Returns `{ status: "success", booking_id }`.
   - `POST /api/payments/webhook`
     - Razorpay-signed webhook (`X-Razorpay-Signature` header) using `webhook_secret`.
     - Handles `payment.captured`, `payment.failed`, `refund.processed` events → updates the booking record.
     - Returns HTTP 200 quickly (idempotent).
3. **All three endpoints must**:
   - Read the payment settings row from Mongo (respect the `enabled` toggle — return 503 when off, same as SMS).
   - Log failures with a correlation id.
   - Never leak `api_secret` or `webhook_secret` in any response.

### Acceptance criteria
- Customer clicks "Pay now" on a booking → gets a real Razorpay checkout widget → completes a ₹1 test payment → booking flips to `paid=true`.
- Wrong signature → verify endpoint returns 400.
- With `enabled=false` → `create-order` returns 503.
- Webhook fires and updates booking status even if the client closes the tab before `/verify`.

---

## Data models expected on `bookings`
Add (if not already present):
```
rzp_order_id: str | None
rzp_payment_id: str | None
payment_status: Literal["pending","captured","failed","refunded"] | None
paid_at: datetime | None
amount_paise: int | None
```

---

## Frontend readiness
- Admin Panel SMS + Payment settings screens are already polished and save-able (verified via curl on preview and production build).
- Once the backend ships the payment endpoints above, the checkout button + Razorpay widget wire-up on the customer booking screen can be done in ~1 dev-day.

---

## Contact
Deployed backend: `https://pro-booking-21.emergent.host`
Deployed frontend: `https://slotnow.co.in` (also `https://slotnow-web.emergent.host`)
