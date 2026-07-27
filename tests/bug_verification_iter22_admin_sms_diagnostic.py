"""
Bug verification (iteration 22): Admin SMS settings — Dry-run + Send-test raw diagnostic panel.

Preview target: https://slotnow-web.preview.emergentagent.com/admin/settings/sms
Backend host mocked: https://pro-booking-21.emergent.host

Frontend-only diagnostic X-ray added to the Admin SMS page so the user can
see the exact backend payload/response when MSG91 sends silently fail.

New test-ids covered:
  - admin-settings-dry-run-btn
  - admin-settings-diagnostic-panel   (rose bg when error, slate when success)
  - admin-settings-diagnostic-json
  - admin-settings-diagnostic-close-btn

Executed scenarios (all PASSED against preview):
  T1  Dry-run success  -> POST /api/admin/settings/sms/dry-run with {phone}
                          diagnostic panel renders slate-tinted, JSON contains
                          would_send_to, template_id, REDACTED, endpoint.
  T2  Send-test success -> POST /api/admin/settings/sms/test-send with {phone},
                          panel renders raw response JSON (provider_used=msg91).
  T3  Send-test 502     -> panel becomes rose-tinted, label includes "HTTP 502",
                          JSON contains {detail:'MSG91 unreachable', code:'E_NETWORK'}.
  T4  Dry-run 500       -> panel rose-tinted, label "HTTP 500", JSON has
                          {detail:'template not found'}.
  T5  Close button      -> admin-settings-diagnostic-close-btn removes panel.
  T6  Gating            -> enabled=OFF hides both buttons; provider=mock hides
                          both buttons; msg91+enabled=true shows both.
  T7  Iter18-21 regression -> DLT template_id/entity_id/variable_name accept
                          alphanumeric+dashes+underscores; PUT body echoes
                          exact values; status card flips to live.
  T8  Payment page      -> none of the SMS diagnostic testids exist on the
                          /admin/settings/payment route.

Loop-prevention note: only bottom-nav overlay caused a false negative on the
first attempt (the buttons sat under a fixed mobile bottom nav). Fix: use a
tall 1440x2000 viewport and scroll_into_view_if_needed() before every click;
force=True was intentionally removed so Playwright's own actionability check
catches overlay interception before it misroutes clicks.
"""

PREVIEW_URL = "https://slotnow-web.preview.emergentagent.com"
API_HOST = "https://pro-booking-21.emergent.host"

MOCKED_ROUTES = [
    "**/api/users/me                       -> 200 admin user",
    "**/api/admin/settings/sms   GET       -> 200 provider=msg91 enabled=true",
    "**/api/admin/settings/sms   PUT       -> 200 echoes body (dlt_* round-trip)",
    "**/api/admin/settings/sms/dry-run     -> 200 payload / 500 {detail:'template not found'}",
    "**/api/admin/settings/sms/test-send   -> 200 success / 502 {detail:'MSG91 unreachable',code:'E_NETWORK'}",
    "**/api/admin/settings/payment GET     -> 200 razorpay",
]

RESULT = "8/8 scenarios PASSED against preview URL (see iteration_22 report)."
