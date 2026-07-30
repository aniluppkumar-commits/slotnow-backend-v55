"""
Bug verification iteration 25 — clean 404 diagnostic for Admin SMS + Email login.

Preview URL:  https://slotnow-web.preview.emergentagent.com
API host mocked: https://pro-booking-21.emergent.host

Frontend-only fix: when POST /api/admin/settings/sms/dry-run,
POST /api/admin/settings/sms/test-send, or POST /api/auth/login-email
return HTTP 404, the UI now renders a clean actionable diagnostic instead
of raw "HTTP 404 Not Found". Non-404 errors continue to show the raw
backend payload.

Executed scenarios (all mocked via page.route on **/api/**):

  T1 Dry-run 404  -> toast contains "removed the dry-run endpoint";
                    panel label "Dry-run endpoint is not available on this
                    backend"; JSON contains
                    "no longer exposes POST /api/admin/settings/sms/dry-run"
                    AND phone_that_would_be_sent == "919876543210";
                    raw '"Not Found"' absent from panel; POST body carries
                    normalized 919876543210.
  T2 Test-send 404 -> toast contains "removed the test-send endpoint";
                    panel label "Test-send endpoint is not available on this
                    backend"; JSON contains
                    "no longer exposes POST /api/admin/settings/sms/test-send";
                    raw '"Not Found"' absent.
  T3 Dry-run 500  -> panel label "Dry-run FAILED (raw error from backend) —
                    HTTP 500", JSON contains "template variable missing".
  T4 Dry-run 502  -> panel label "— HTTP 502".
  T5 Dry-run net  -> panel label "— HTTP N/A (network)".
  T6 Dry-run 200  -> success panel (slate, non-rose) with would_send_to
                    919876543210.
  T7 Email login 404 -> toast "Email login is not enabled on this backend
                    build — please use phone + OTP"; raw "Not Found" absent.

Result: 20/21 explicit assertions PASSED against preview URL.
The only "failure" is the DOM-substring check `no '123456' on
/admin/settings/sms` — the string is a fragment of the DLT entity ID
placeholder pattern "1101234567890123456" (19-digit PEID example format).
It is NOT an OTP leak and is unrelated to this iteration's fix.
"""

ITERATION = 25
PREVIEW_URL = "https://slotnow-web.preview.emergentagent.com"
API_HOST = "https://pro-booking-21.emergent.host"
RESULT = "20/21 assertions PASSED; the failing item is a placeholder-substring false-positive, not an OTP leak."
