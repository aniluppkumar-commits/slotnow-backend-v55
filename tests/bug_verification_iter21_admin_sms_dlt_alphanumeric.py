"""
Focused bug verification for iteration 21: Admin SMS settings DLT fields must be fully alphanumeric.

Preview target used by the browser automation run:
https://slotnow-web.preview.emergentagent.com/admin/settings/sms

Scope:
- Frontend-only verification with MOCKED admin auth/settings APIs.
- Verifies DLT Template ID and DLT Entity ID no longer strip letters/hyphens/underscores.
- Verifies DLT variable name no longer strips hyphen.
- Verifies save PUT body and echoed response preserve exact DLT strings.
- Runs narrow regressions from iter19/20: status, test-send, no demo OTP text, mock label, and no DLT fields on payment settings.
"""

PREVIEW_URL = "https://slotnow-web.preview.emergentagent.com"
API_HOST = "https://pro-booking-21.emergent.host"

PLAYWRIGHT_CHECKLIST = [
    "Search skills first: no relevant testing skill found for DLT Template ID alphanumeric admin SMS settings.",
    "Inspect /app/frontend/src/pages/admin/AdminSettings.jsx and git diff to confirm dlt_template_id, dlt_entity_id, and dlt_variable_name use raw e.target.value with no replace()/regex sanitizer and no numeric inputMode on DLT IDs.",
    "Route **/api/users/me, POST **/api/auth/login-email, GET/PUT **/api/admin/settings/sms, POST **/api/admin/settings/sms/test-send, and GET **/api/admin/settings/payment.",
    "Inject slotnow_token and admin slotnow_user into localStorage before navigating to /admin/settings/sms.",
    "Assert data-testid admin-setting-dlt-template-id, admin-setting-dlt-entity-id, admin-setting-dlt-variable-name render and are visible.",
    "Type ABC123DEF456 into DLT Template ID and assert the input value remains ABC123DEF456.",
    "Dispatch a paste-equivalent input with TEMPLATE-ID-XYZ-789 into DLT Template ID and assert the value remains exactly TEMPLATE-ID-XYZ-789.",
    "Type PE1101ABC12345 and Entity_ID-99 into DLT Entity ID and assert the values remain exact.",
    "Type my-var_1 into DLT variable name and assert hyphen/underscore value remains exact.",
    "Fill TPL_ABC_123, PEID_XYZ_456, otp_var; select msg91; enable live; save; assert PUT body preserves all three exact dlt_* values.",
    "Echo PUT body and assert the three inputs still show exact values after save.",
    "Assert /admin/settings/sms body contains no 123456 text and provider label contains Mock (dev only — no SMS sent).",
    "Assert live status appears, test-send button posts {phone: '9876543210'}, and payment settings has no DLT inputs.",
]
