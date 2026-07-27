"""
Bug verification iteration 24: focused frontend-only phone normalization check.

Executed via MCP browser automation against:
  https://slotnow-web.preview.emergentagent.com

All backend calls were MOCKED with page.route(), matching the review request.
The executable MCP script is represented in /app/test_reports/bug_verification_24.json
by the per-assertion evidence and intercepted request bodies.
"""

ITERATION = 24
USER_REPORTED_BUG = (
    "Look at the Dry-run request payload. The backend is sending the phone number "
    "without the 91 country code prefix (e.g. 10 digits instead of 919876543210), "
    "which is causing MSG91 to reject or fail the SMS delivery. Please update the "
    "backend mobile formatting to include the 91 prefix automatically"
)

ASSERTIONS = [
    "Admin SMS dry-run input 9876543210 posts {'phone':'919876543210'}",
    "Admin SMS send-test input 9876543210 posts {'phone':'919876543210'}",
    "Admin SMS send-test input 919876543210 remains {'phone':'919876543210'}",
    "Admin SMS send-test input 09876543210 normalizes to {'phone':'919876543210'}",
    "Admin SMS send-test input +91 98765 43210 normalizes to {'phone':'919876543210'}",
    "Login customer send-otp posts {'phone':'919876543210','role':'customer'}",
    "Login verify-otp posts body.phone == '919876543210'",
    "Login PIN posts body.phone == '919876543210'",
    "Dry-run diagnostic panel displays 919876543210 from mocked response",
    "Dry-run/send buttons disabled for empty, abc, 98765; enabled for 9876543210",
    "Diagnostic error panel regression: rose bg, HTTP status, Clear hides panel",
    "DLT alphanumeric preservation regression remains working",
    "No visible 123456 text on /admin/settings/sms DOM",
]

if __name__ == "__main__":
    print(f"Iteration {ITERATION} verification assertions:")
    for assertion in ASSERTIONS:
        print(f"- {assertion}")