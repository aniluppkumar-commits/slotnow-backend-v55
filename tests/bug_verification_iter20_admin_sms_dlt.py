"""
Focused bug verification for iteration 20: Admin SMS settings DLT fields.

This script is mirrored in the browser automation run against:
https://slotnow-web.preview.emergentagent.com/admin/settings/sms

Scope:
- MOCKED admin auth + settings APIs only.
- Verify DLT Template ID, DLT Entity ID, and DLT variable name render/edit.
- Verify DLT Entity ID digit-only sanitization.
- Verify save PUT body includes all dlt_* fields and echoed response rehydrates UI.
- Verify live status/test-send regression and payment page has no DLT fields.
"""

PREVIEW_URL = "https://slotnow-web.preview.emergentagent.com"
API_HOST = "https://pro-booking-21.emergent.host"

PLAYWRIGHT_CHECKLIST = [
    "Route **/api/users/me, GET/PUT **/api/admin/settings/sms, POST **/api/admin/settings/sms/test-send, GET **/api/admin/settings/payment.",
    "Inject slotnow_token and admin slotnow_user into localStorage before navigating to /admin/settings/sms.",
    "Assert data-testid admin-setting-dlt-template-id, admin-setting-dlt-entity-id, admin-setting-dlt-variable-name render and are visible.",
    "Assert dlt_variable_name default is num.",
    "Fill DLT IDs and assert DOM values persist.",
    "Paste ABC1234XYZ5678 into DLT Entity ID and assert sanitized value is 12345678.",
    "Save msg91 settings with enabled ON and assert PUT body contains dlt_template_id, dlt_entity_id, dlt_variable_name.",
    "Echo PUT body and assert all three DLT fields remain populated after save toast.",
    "Assert no 123456 demo OTP text, status changes off->live, send-test appears, and POST body contains phone.",
    "Navigate to /admin/settings/payment and assert no dlt_* fields are present.",
]