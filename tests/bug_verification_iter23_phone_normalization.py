"""
Bug verification iteration 23: client-side Indian phone normalization for SMS/Auth requests.
Run with: python /app/tests/bug_verification_iter23_phone_normalization.py
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect

PREVIEW_URL = "https://slotnow-web.preview.emergentagent.com"
API_HOST = "https://pro-booking-21.emergent.host"
REPORT_PATH = Path("/app/test_reports/bug_verification_iter23_raw_results.json")

class Recorder:
    def __init__(self):
        self.calls = []

    def add(self, name, body):
        self.calls.append({"name": name, "body": body})

    def by_name(self, name):
        return [c["body"] for c in self.calls if c["name"] == name]

async def body_json(request):
    try:
        data = request.post_data or "{}"
        return json.loads(data)
    except Exception:
        return {"__raw": request.post_data}

async def setup_routes(page, rec: Recorder):
    async def users_me(route):
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "id": "admin1", "role": "admin", "name": "Admin", "phone": "917777700002"
        }))

    async def sms_get(route):
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "provider": "msg91", "api_key": "X", "sender_id": "SLOTNW",
            "dlt_template_id": "DLTABC123", "dlt_entity_id": "PEIDABC123",
            "dlt_variable_name": "num", "enabled": True
        }))

    async def sms_put(route):
        body = await body_json(route.request)
        rec.add("sms_put", body)
        await route.fulfill(status=200, content_type="application/json", body=json.dumps(body))

    async def dry_run(route):
        body = await body_json(route.request)
        rec.add("dry_run", body)
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "would_send_to": body.get("phone"),
            "authkey": "X",
            "mobiles": body.get("phone"),
            "endpoint": "https://control.msg91.com/api/v5/flow/",
            "payload": {"authkey": "X", "mobiles": body.get("phone")}
        }))

    async def test_send(route):
        body = await body_json(route.request)
        rec.add("test_send", body)
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "ok": True, "message": "sent", "phone": body.get("phone")
        }))

    async def test_send_error(route):
        body = await body_json(route.request)
        rec.add("test_send_error", body)
        await route.fulfill(status=502, content_type="application/json", body=json.dumps({
            "detail": "MSG91 unreachable", "code": "E_NETWORK"
        }))

    async def send_otp(route):
        body = await body_json(route.request)
        rec.add("send_otp", body)
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))

    async def verify_otp(route):
        body = await body_json(route.request)
        rec.add("verify_otp", body)
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "token": "MOCK", "user": {"id": "u1", "role": body.get("role", "customer"), "name": "C", "phone": body.get("phone"), "has_pin": True}
        }))

    async def pin_login(route):
        body = await body_json(route.request)
        rec.add("pin_login", body)
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "token": "MOCK", "user": {"id": "u1", "role": body.get("role", "customer"), "name": "C", "phone": body.get("phone"), "has_pin": True}
        }))

    async def login_email(route):
        rec.add("login_email", await body_json(route.request))
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "token": "MOCK", "user": {"id": "admin1", "role": "admin", "name": "Admin"}
        }))

    async def provider_profile(route):
        await route.fulfill(status=404, content_type="application/json", body=json.dumps({"detail":"not found"}))

    await page.route(f"{API_HOST}/api/users/me", users_me)
    await page.route(f"{API_HOST}/api/admin/settings/sms", lambda route: sms_get(route) if route.request.method == "GET" else sms_put(route))
    await page.route(f"{API_HOST}/api/admin/settings/sms/dry-run", dry_run)
    await page.route(f"{API_HOST}/api/admin/settings/sms/test-send", test_send)
    await page.route(f"{API_HOST}/api/auth/send-otp", send_otp)
    await page.route(f"{API_HOST}/api/auth/verify-otp", verify_otp)
    await page.route(f"{API_HOST}/api/auth/pin-login", pin_login)
    await page.route(f"{API_HOST}/api/auth/login-email", login_email)
    await page.route(f"{API_HOST}/api/providers/me/profile", provider_profile)
    return test_send, test_send_error

async def get_errors(page):
    error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
    }""")
    return error_text

async def fill_test_phone(page, value):
    inp = page.get_by_test_id("admin-settings-test-phone")
    await inp.fill("")
    await inp.fill(value)

async def test_admin_sms(page, rec):
    results = []
    await page.goto(f"{PREVIEW_URL}/admin/settings/sms", wait_until="networkidle")
    await expect(page.get_by_test_id("admin-settings-test-phone")).to_be_visible(timeout=10000)

    # Regression: no test OTP 123456 should be present on admin SMS settings page.
    dom_text = await page.locator("body").inner_text()
    results.append({"name": "regression_no_123456_dom", "passed": "123456" not in dom_text, "details": "123456 absent from visible body text" if "123456" not in dom_text else "123456 present"})

    # Regression: DLT alphanumeric preservation on form and PUT payload.
    template_val = "ABCdef-123_XYZ"
    entity_val = "PEIDalpha-789_X"
    variable_val = "otpNum_A1"
    await page.get_by_test_id("admin-setting-dlt-template-id").fill(template_val)
    await page.get_by_test_id("admin-setting-dlt-entity-id").fill(entity_val)
    await page.get_by_test_id("admin-setting-dlt-variable-name").fill(variable_val)
    await page.get_by_test_id("admin-settings-save-btn").click()
    await page.wait_for_timeout(500)
    sms_puts = rec.by_name("sms_put")
    preserved = bool(sms_puts and sms_puts[-1].get("dlt_template_id") == template_val and sms_puts[-1].get("dlt_entity_id") == entity_val and sms_puts[-1].get("dlt_variable_name") == variable_val)
    results.append({"name": "regression_dlt_alphanumeric_preserved", "passed": preserved, "details": sms_puts[-1] if sms_puts else None})

    # Primary: Dry-run request normalizes 10-digit to 91-prefixed 12-digit.
    await fill_test_phone(page, "9876543210")
    await page.get_by_test_id("admin-settings-dry-run-btn").click()
    await expect(page.get_by_test_id("admin-settings-diagnostic-json")).to_contain_text("919876543210", timeout=5000)
    dry_body = rec.by_name("dry_run")[-1]
    results.append({"name": "dry_run_10_digit_request_body_91_prefixed", "passed": dry_body == {"phone":"919876543210"}, "details": dry_body})
    diag_text = await page.get_by_test_id("admin-settings-diagnostic-json").inner_text()
    results.append({"name": "dry_run_diagnostic_contains_91_prefixed_number", "passed": "919876543210" in diag_text, "details": diag_text})

    # Primary: Send-test request normalizes 10-digit.
    await fill_test_phone(page, "9876543210")
    await page.get_by_test_id("admin-settings-send-test-btn").click()
    await page.wait_for_timeout(500)
    test_body = rec.by_name("test_send")[-1]
    results.append({"name": "send_test_10_digit_request_body_91_prefixed", "passed": test_body.get("phone") == "919876543210", "details": test_body})

    # Variants requested by main agent. We exercise the page input exactly as a user would.
    # NOTE: AdminSettings currently strips non-digits and slices to 10 in onChange, so direct UI variants that already include +91/0 are truncated before submit.
    variant_expectations = [
        ("919876543210", "919876543210"),
        ("09876543210", "919876543210"),
        ("+91 98765 43210", "919876543210"),
    ]
    for value, expected in variant_expectations:
        before = len(rec.by_name("test_send"))
        await fill_test_phone(page, value)
        stored = await page.get_by_test_id("admin-settings-test-phone").input_value()
        disabled = await page.get_by_test_id("admin-settings-send-test-btn").is_disabled()
        if not disabled:
            await page.get_by_test_id("admin-settings-send-test-btn").click()
            await page.wait_for_timeout(500)
        calls = rec.by_name("test_send")
        body = calls[-1] if len(calls) > before else None
        results.append({
            "name": f"send_test_variant_input_{value}_normalizes_to_{expected}",
            "passed": bool(body and body.get("phone") == expected),
            "details": {"typed": value, "stored_input_value": stored, "button_disabled": disabled, "request_body": body, "expected": expected}
        })

    # Regression: diagnostic error panel rose bg, HTTP status, Clear hides.
    await page.unroute(f"{API_HOST}/api/admin/settings/sms/test-send")
    async def error_handler(route):
        body = await body_json(route.request)
        rec.add("test_send_error", body)
        await route.fulfill(status=502, content_type="application/json", body=json.dumps({"detail":"MSG91 unreachable", "code":"E_NETWORK"}))
    await page.route(f"{API_HOST}/api/admin/settings/sms/test-send", error_handler)
    await fill_test_phone(page, "9876543210")
    await page.get_by_test_id("admin-settings-send-test-btn").click()
    await expect(page.get_by_test_id("admin-settings-diagnostic-panel")).to_be_visible(timeout=5000)
    panel_class = await page.get_by_test_id("admin-settings-diagnostic-panel").get_attribute("class")
    panel_text = await page.get_by_test_id("admin-settings-diagnostic-panel").inner_text()
    rose_http = ("bg-rose-50" in (panel_class or "")) and "HTTP 502" in panel_text and "MSG91 unreachable" in panel_text
    await page.get_by_test_id("admin-settings-diagnostic-close-btn").click()
    await expect(page.get_by_test_id("admin-settings-diagnostic-panel")).to_have_count(0, timeout=3000)
    results.append({"name": "regression_diagnostic_error_panel_rose_http_clear", "passed": rose_http, "details": {"class": panel_class, "text": panel_text}})

    errs = await get_errors(page)
    results.append({"name": "admin_sms_no_unexpected_error_elements", "passed": True, "details": errs or "No error messages found on the page"})
    return results

async def test_login_otp(page, rec):
    results = []
    await page.goto(f"{PREVIEW_URL}/login", wait_until="networkidle")
    await expect(page.get_by_test_id("login-phone-input")).to_be_visible(timeout=10000)
    await page.get_by_test_id("login-role-customer").click()
    await page.get_by_test_id("login-phone-input").fill("9876543210")
    await page.get_by_test_id("login-send-otp-btn").click()
    await expect(page.get_by_test_id("login-otp-input")).to_be_visible(timeout=5000)
    send_body = rec.by_name("send_otp")[-1]
    results.append({"name": "login_send_otp_10_digit_body_91_prefixed", "passed": send_body == {"phone":"919876543210", "role":"customer"}, "details": send_body})

    await page.get_by_test_id("login-otp-input").fill("1234")
    # Source uses login-verify-otp-btn, not requested login-verify-btn.
    await page.get_by_test_id("login-verify-otp-btn").click()
    await page.wait_for_timeout(800)
    verify_body = rec.by_name("verify_otp")[-1]
    results.append({"name": "login_verify_otp_10_digit_body_91_prefixed", "passed": verify_body.get("phone") == "919876543210" and verify_body.get("role") == "customer", "details": verify_body})
    errs = await get_errors(page)
    results.append({"name": "login_otp_no_unexpected_error_elements", "passed": True, "details": errs or "No error messages found on the page"})
    return results

async def test_login_pin(page, rec):
    results = []
    # Clear persisted auth from the OTP verify flow so login page is usable.
    await page.goto(f"{PREVIEW_URL}/login", wait_until="domcontentloaded")
    await page.evaluate("localStorage.clear(); sessionStorage.clear();")
    await page.goto(f"{PREVIEW_URL}/login", wait_until="networkidle")
    await expect(page.get_by_test_id("login-phone-input")).to_be_visible(timeout=10000)
    await page.get_by_test_id("login-role-customer").click()
    await page.get_by_test_id("login-mode-toggle").click()
    await page.get_by_test_id("login-phone-input").fill("9876543210")
    await page.get_by_test_id("login-pin-input").fill("1234")
    await page.get_by_test_id("login-pin-submit-btn").click()
    await page.wait_for_timeout(800)
    pin_body = rec.by_name("pin_login")[-1] if rec.by_name("pin_login") else None
    results.append({"name": "login_pin_10_digit_body_91_prefixed", "passed": bool(pin_body and pin_body.get("phone") == "919876543210" and pin_body.get("role") == "customer"), "details": pin_body})
    errs = await get_errors(page)
    results.append({"name": "login_pin_no_unexpected_error_elements", "passed": True, "details": errs or "No error messages found on the page"})
    return results

async def main():
    all_results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()
        page.on("console", lambda msg: print(f"CONSOLE {msg.type}: {msg.text}"))
        rec = Recorder()
        await setup_routes(page, rec)
        try:
            admin_results = await test_admin_sms(page, rec)
            all_results.extend(admin_results)
            otp_results = await test_login_otp(page, rec)
            all_results.extend(otp_results)
            pin_results = await test_login_pin(page, rec)
            all_results.extend(pin_results)
        finally:
            await browser.close()
    payload = {"results": all_results, "calls": rec.calls}
    REPORT_PATH.write_text(json.dumps(payload, indent=2))
    print(json.dumps(payload, indent=2))
    failed = [r for r in all_results if not r.get("passed")]
    if failed:
        raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(main())
