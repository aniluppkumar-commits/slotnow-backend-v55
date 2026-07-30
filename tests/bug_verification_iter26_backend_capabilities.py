"""
Bug verification iteration 26 — backend capability gating for Admin SMS diagnostics
and Login email toggle.

All backend calls are MOCKED with Playwright route handlers. The key mock is
GET https://pro-booking-21.emergent.host/openapi.json, installed before each
navigation so useBackendCapabilities() observes the desired backend state.
"""

import asyncio
import json
import traceback
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect


PREVIEW_URL = "https://slotnow-web.preview.emergentagent.com"
API_HOST = "pro-booking-21.emergent.host"

ADMIN_USER = {
    "id": "admin-test-user",
    "phone": "7777700002",
    "role": "admin",
    "name": "Test Admin",
}

BASE_SMS = {
    "provider": "msg91",
    "api_key": "secret-key",
    "sender_id": "SLOTNW",
    "dlt_template_id": "DLTABC123XYZ",
    "dlt_entity_id": "PEIDABC987XYZ",
    "dlt_variable_name": "num",
    "enabled": True,
}


def openapi_spec(paths):
    return {"openapi": "3.0.0", "info": {"title": "mock", "version": "test"}, "paths": {p: {} for p in paths}}


async def new_page(browser, *, openapi_paths=None, openapi_status=200, sms=None, dry_run_status=200, dry_run_json=None, test_send_status=200, auth=True):
    context = await browser.new_context(viewport={"width": 1920, "height": 1080})
    captured = {"requests": [], "dry_run_posts": [], "test_send_posts": [], "put_sms": []}
    openapi_seen = asyncio.Event()

    if auth:
        await context.add_init_script(
            f"""
                const user = {json.dumps(ADMIN_USER)};
                window.localStorage.setItem('slotnow_token', 'test-admin-token');
                window.localStorage.setItem('slotnow_user', JSON.stringify(user));
            """
        )

    sms_payload = {**BASE_SMS, **(sms or {})}
    dry_run_payload = dry_run_json if dry_run_json is not None else {
        "would_send_to": "919876543210",
        "payload": {
            "mobile": "919876543210",
            "sender": sms_payload["sender_id"],
            "template_id": sms_payload["dlt_template_id"],
            "entity_id": sms_payload["dlt_entity_id"],
        },
    }

    async def handler(route):
        req = route.request
        parsed = urlparse(req.url)
        if parsed.netloc != API_HOST:
            await route.continue_()
            return

        path = parsed.path
        method = req.method.upper()
        captured["requests"].append({"method": method, "path": path})

        if path == "/openapi.json" and method == "GET":
            openapi_seen.set()
            if openapi_status != 200:
                await route.fulfill(status=openapi_status, content_type="application/json", body=json.dumps({"detail": "openapi failed"}))
            else:
                await route.fulfill(status=200, content_type="application/json", body=json.dumps(openapi_spec(openapi_paths or [])))
            return

        if path == "/api/users/me" and method == "GET":
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(ADMIN_USER))
            return

        if path == "/api/admin/settings/sms" and method == "GET":
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(sms_payload))
            return

        if path == "/api/admin/settings/sms" and method == "PUT":
            body = req.post_data_json
            captured["put_sms"].append(body)
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
            return

        if path == "/api/admin/settings/sms/dry-run" and method == "POST":
            body = req.post_data_json
            captured["dry_run_posts"].append(body)
            if dry_run_status == 200:
                await route.fulfill(status=200, content_type="application/json", body=json.dumps(dry_run_payload))
            else:
                response_body = dry_run_payload if isinstance(dry_run_payload, dict) else {"detail": "Not Found"}
                await route.fulfill(status=dry_run_status, content_type="application/json", body=json.dumps(response_body))
            return

        if path == "/api/admin/settings/sms/test-send" and method == "POST":
            body = req.post_data_json
            captured["test_send_posts"].append(body)
            if test_send_status == 200:
                await route.fulfill(status=200, content_type="application/json", body=json.dumps({"message": "sent"}))
            else:
                await route.fulfill(status=test_send_status, content_type="application/json", body=json.dumps({"detail": "Not Found"}))
            return

        await route.fulfill(status=404, content_type="application/json", body=json.dumps({"detail": f"Unhandled mock {method} {path}"}))

    await context.route("**/*", handler)
    page = await context.new_page()
    return context, page, captured, openapi_seen


async def goto_admin(page, openapi_seen):
    await page.goto(f"{PREVIEW_URL}/admin/settings/sms", wait_until="domcontentloaded")
    try:
        await page.wait_for_selector('[data-testid="admin-setting-provider"]', timeout=10000)
    except Exception:
        body = await page.locator("body").inner_text(timeout=1000) if await page.locator("body").count() else "<no body>"
        print(f"DEBUG goto_admin url={page.url} body={body[:1000]!r}")
        raise
    await asyncio.wait_for(openapi_seen.wait(), timeout=5)
    await page.wait_for_timeout(300)


async def goto_login(page, openapi_seen):
    await page.goto(f"{PREVIEW_URL}/login", wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="login-phone-input"]', timeout=10000)
    await asyncio.wait_for(openapi_seen.wait(), timeout=5)
    await page.wait_for_timeout(300)


async def count(page, selector):
    return await page.locator(selector).count()


async def expect_count(page, selector, expected, label):
    actual = await count(page, selector)
    assert actual == expected, f"{label}: expected {expected}, got {actual} for {selector}"


async def test_current_rolled_back(browser):
    paths = []
    ctx, page, _captured, event = await new_page(browser, openapi_paths=paths, auth=True)
    try:
        await goto_admin(page, event)
        await expect_count(page, '[data-testid="admin-settings-dry-run-btn"]', 0, "dry-run hidden when absent from openapi")
        await expect_count(page, '[data-testid="admin-settings-send-test-btn"]', 0, "send-test hidden when absent from openapi")
        await expect_count(page, 'text=SMS diagnostics', 0, "SMS diagnostics section hidden when both absent")
    finally:
        await ctx.close()

    ctx, page, _captured, event = await new_page(browser, openapi_paths=paths, auth=False)
    try:
        await goto_login(page, event)
        await expect_count(page, '[data-testid="login-email-toggle-btn"]', 0, "email login toggle hidden when login-email absent")
    finally:
        await ctx.close()


async def test_restored_backend(browser):
    paths = [
        "/api/admin/settings/sms/dry-run",
        "/api/admin/settings/sms/test-send",
        "/api/auth/login-email",
    ]
    ctx, page, _captured, event = await new_page(browser, openapi_paths=paths, auth=True)
    try:
        await goto_admin(page, event)
        await expect_count(page, '[data-testid="admin-settings-dry-run-btn"]', 1, "dry-run visible when listed")
        await expect_count(page, '[data-testid="admin-settings-send-test-btn"]', 1, "send-test visible when listed")
        await expect_count(page, 'text=SMS diagnostics', 1, "SMS diagnostics visible when both listed")
    finally:
        await ctx.close()

    ctx, page, _captured, event = await new_page(browser, openapi_paths=paths, auth=False)
    try:
        await goto_login(page, event)
        await expect_count(page, '[data-testid="login-email-toggle-btn"]', 1, "email login toggle visible when login-email listed")
    finally:
        await ctx.close()


async def test_mixed_dry_only(browser):
    paths = ["/api/admin/settings/sms/dry-run"]
    ctx, page, _captured, event = await new_page(browser, openapi_paths=paths, auth=True)
    try:
        await goto_admin(page, event)
        await expect_count(page, '[data-testid="admin-settings-dry-run-btn"]', 1, "dry-run visible in mixed state")
        await expect_count(page, '[data-testid="admin-settings-send-test-btn"]', 0, "send-test hidden in mixed state")
        await expect_count(page, 'text=SMS diagnostics', 1, "SMS diagnostics visible when at least one tool exists")
    finally:
        await ctx.close()


async def test_fail_open(browser):
    ctx, page, _captured, event = await new_page(browser, openapi_status=500, auth=True)
    try:
        await goto_admin(page, event)
        await expect_count(page, '[data-testid="admin-settings-dry-run-btn"]', 1, "dry-run fail-open visible")
        await expect_count(page, '[data-testid="admin-settings-send-test-btn"]', 1, "send-test fail-open visible")
    finally:
        await ctx.close()

    ctx, page, _captured, event = await new_page(browser, openapi_status=500, auth=False)
    try:
        await goto_login(page, event)
        await expect_count(page, '[data-testid="login-email-toggle-btn"]', 1, "email login toggle fail-open visible")
    finally:
        await ctx.close()


async def test_dry_run_404_clean_and_phone_normalization(browser):
    ctx, page, captured, event = await new_page(
        browser,
        openapi_paths=["/api/admin/settings/sms/dry-run"],
        dry_run_status=404,
        dry_run_json={"detail": "Not Found"},
        auth=True,
    )
    try:
        await goto_admin(page, event)
        await page.fill('[data-testid="admin-settings-test-phone"]', "9876543210")
        await page.click('[data-testid="admin-settings-dry-run-btn"]')
        await page.wait_for_selector('[data-testid="admin-settings-diagnostic-panel"]', timeout=10000)
        await expect(page.get_by_text("This backend build has removed the dry-run endpoint")).to_be_visible(timeout=5000)
        await expect(page.get_by_text("Dry-run endpoint is not available on this backend")).to_be_visible()
        panel_json = await page.locator('[data-testid="admin-settings-diagnostic-json"]').inner_text()
        assert "no longer exposes POST /api/admin/settings/sms/dry-run" in panel_json, "clean 404 note missing dry-run endpoint text"
        assert '"Not Found"' not in panel_json, "raw Not Found leaked into diagnostic JSON"
        assert captured["dry_run_posts"], "dry-run POST was not captured"
        assert captured["dry_run_posts"][-1] == {"phone": "919876543210"}, f"phone not normalized: {captured['dry_run_posts'][-1]}"
    finally:
        await ctx.close()


async def test_dlt_alphanumeric_preserved_on_save(browser):
    ctx, page, captured, event = await new_page(
        browser,
        openapi_paths=[],
        sms={"dlt_template_id": "DLTABC123XYZ", "dlt_entity_id": "PEIDABC987XYZ"},
        auth=True,
    )
    try:
        await goto_admin(page, event)
        await expect(page.locator('[data-testid="admin-setting-dlt-template-id"]')).to_have_value("DLTABC123XYZ")
        await expect(page.locator('[data-testid="admin-setting-dlt-entity-id"]')).to_have_value("PEIDABC987XYZ")
        await page.fill('[data-testid="admin-setting-dlt-template-id"]', "DLTNEWABC123XYZ")
        await page.fill('[data-testid="admin-setting-dlt-entity-id"]', "PEIDNEWABC987XYZ")
        await page.click('[data-testid="admin-settings-save-btn"]')

        for _ in range(30):
            if captured["put_sms"]:
                break
            await page.wait_for_timeout(100)
        assert captured["put_sms"], "settings PUT was not captured"
        body = captured["put_sms"][-1]
        assert body["dlt_template_id"] == "DLTNEWABC123XYZ", f"template ID not preserved: {body}"
        assert body["dlt_entity_id"] == "PEIDNEWABC987XYZ", f"entity ID not preserved: {body}"
    finally:
        await ctx.close()


async def test_non_404_diagnostic_panel_structure(browser):
    ctx, page, _captured, event = await new_page(
        browser,
        openapi_paths=["/api/admin/settings/sms/dry-run"],
        dry_run_status=500,
        dry_run_json={"detail": "template variable missing"},
        auth=True,
    )
    try:
        await goto_admin(page, event)
        await page.fill('[data-testid="admin-settings-test-phone"]', "+91 9876543210")
        await page.click('[data-testid="admin-settings-dry-run-btn"]')
        panel = page.locator('[data-testid="admin-settings-diagnostic-panel"]')
        await panel.wait_for(timeout=10000)
        panel_class = await panel.get_attribute("class")
        assert "bg-rose-50" in panel_class and "border-rose-200" in panel_class, f"non-404 panel does not use rose error style: {panel_class}"
        await expect(panel.get_by_text("HTTP 500")).to_be_visible()
        await expect(page.locator('[data-testid="admin-settings-diagnostic-json"]')).to_contain_text("template variable missing")
        await expect_count(page, '[data-testid="admin-settings-diagnostic-close-btn"]', 1, "diagnostic clear button visible")
        await page.click('[data-testid="admin-settings-diagnostic-close-btn"]')
        await expect_count(page, '[data-testid="admin-settings-diagnostic-panel"]', 0, "diagnostic panel clears")
    finally:
        await ctx.close()


TESTS = [
    ("current_rolled_back_backend_hides_absent_tools", test_current_rolled_back),
    ("restored_backend_shows_all_tools", test_restored_backend),
    ("mixed_dry_only_state", test_mixed_dry_only),
    ("openapi_failure_fails_open", test_fail_open),
    ("dry_run_404_clean_and_phone_normalization", test_dry_run_404_clean_and_phone_normalization),
    ("dlt_alphanumeric_preserved_on_save", test_dlt_alphanumeric_preserved_on_save),
    ("non_404_diagnostic_panel_structure", test_non_404_diagnostic_panel_structure),
]


async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path="/root/bin/chromium")
        try:
            for name, fn in TESTS:
                try:
                    await fn(browser)
                    print(f"PASS {name}")
                    results.append({"name": name, "status": "passed"})
                except Exception as exc:
                    tb = traceback.format_exc()
                    print(f"FAIL {name}: {exc}\n{tb}")
                    results.append({"name": name, "status": "failed", "error": str(exc)})
        finally:
            await browser.close()

    output = {
        "total": len(results),
        "passed": sum(1 for r in results if r["status"] == "passed"),
        "failed": sum(1 for r in results if r["status"] == "failed"),
        "results": results,
    }
    print(json.dumps(output, indent=2))
    with open("/app/test_reports/iter26_playwright_results.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    if output["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())