"""
Focused bug-verification harness for admin SMS settings demo-OTP copy regression.

Intended execution: via Playwright browser automation against preview
https://slotnow-web.preview.emergentagent.com with mocked admin auth/settings APIs.
This file documents the exact assertions executed in iteration 19; browser output
is summarized in /app/test_reports/bug_verification_19.json.
"""

PREVIEW_URL = "https://slotnow-web.preview.emergentagent.com"
API_HOST = "https://pro-booking-21.emergent.host"

CHECKS = [
    "Inject admin token/user into localStorage and mock /api/users/me.",
    "Mock GET/PUT /api/admin/settings/sms and /api/admin/settings/payment.",
    "Assert /admin/settings/sms document.body.innerText does not contain 123456.",
    "Open provider dropdown and assert body/select option text does not contain 123456.",
    "Verify DLT Template ID input renders and strips non-digits.",
    "Change provider to MSG91, enable, save, and verify status flips OFF to Live.",
    "Verify Test SMS section appears only for enabled non-mock SMS provider.",
    "Submit valid test phone and capture POST /api/admin/settings/sms/test-send body.",
    "Verify payment settings renders payment fields and no SMS Test section.",
    "Inject a forced Login render error into the served bundle and verify ErrorBoundary fallback/reload appears.",
]
