"""Playwright UI script used by the testing agent for bug 38.

This file records the browser checks executed via mcp_browser_automation. It is
intended as an audit artifact, not as a standalone pytest module.
"""

SCRIPT = r'''
try:
    await page.set_viewport_size({"width": 1920, "height": 1080})
    base = "https://slotnow-web.preview.emergentagent.com"

    async def print_error_messages():
        error_text = await page.evaluate("""() => {
const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
return errorElements.map(el => el.textContent).join(", ");
}""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

    async def pin_login(phone):
        await page.goto(f"{base}/login", wait_until="domcontentloaded")
        await page.evaluate("localStorage.clear(); sessionStorage.clear();")
        await page.goto(f"{base}/login", wait_until="networkidle")
        await page.get_by_test_id("login-role-provider").click()
        if await page.get_by_test_id("login-pin-input").count() == 0:
            await page.get_by_test_id("login-mode-toggle").click()
        await page.get_by_test_id("login-phone-input").fill(phone)
        await page.get_by_test_id("login-pin-input").fill("1234")
        await page.get_by_test_id("login-pin-submit-btn").click()
        await page.wait_for_url("**/provider", timeout=20000)
        print(f"PASS: provider PIN login completed for {phone}; current url={page.url}")

    await pin_login("9000000007")
    await page.goto(f"{base}/provider/availability", wait_until="networkidle")
    callout = page.get_by_test_id("availability-hospital-callout")
    await callout.wait_for(state="visible", timeout=15000)
    callout_text = await callout.inner_text()
    assert "per-doctor" in callout_text.lower(), f"Callout missing per-doctor guidance: {callout_text}"
    assert "schedule" in callout_text.lower(), f"Callout missing schedule guidance: {callout_text}"
    print(f"PASS: availability hospital callout visible with guidance text: {callout_text[:180]}")
    await page.get_by_test_id("availability-goto-staff").click()
    await page.wait_for_url("**/provider/staff", timeout=10000)
    print("PASS: availability-goto-staff navigates to /provider/staff")
    await page.goto(f"{base}/provider/availability", wait_until="networkidle")
    await page.get_by_test_id("availability-goto-grid").click()
    await page.wait_for_url("**/provider/schedule-grid", timeout=10000)
    print("PASS: availability-goto-grid navigates to /provider/schedule-grid")

    await page.goto(f"{base}/provider/assistants", wait_until="networkidle")
    await page.locator('[data-testid^="assistant-item-"]').first.wait_for(state="visible", timeout=15000)
    rows = page.locator('[data-testid^="assistant-item-"]')
    row_count = await rows.count()
    assert row_count > 0, "No assistant rows visible"
    for i in range(row_count):
        row_text = await rows.nth(i).inner_text()
        assert "Assign" in row_text, f"Assistant row {i} missing Assign button: {row_text}"
        assert "Mapped to" in row_text and "/ 3 doctors/services" in row_text, f"Assistant row {i} missing mapping text: {row_text}"
    print(f"PASS: {row_count} assistant row(s) show Assign label and mapping text")
    await page.locator('[data-testid^="assistant-assign-"]').first.click()
    await page.get_by_test_id("assign-count").wait_for(state="visible", timeout=10000)
    checkbox_locator = page.locator('input[data-testid^="assign-"]')
    cb_count = await checkbox_locator.count()
    assert cb_count >= 4, f"Need >=4 staff checkboxes to verify UI cap, found {cb_count}"
    async def selected_count():
        return await page.evaluate("""() => Array.from(document.querySelectorAll('input[data-testid^="assign-"]')).filter(cb => cb.checked).length""")
    for idx in range(cb_count):
        if await selected_count() >= 3:
            break
        cb = checkbox_locator.nth(idx)
        if not await cb.is_checked():
            await cb.click(force=True)
            await page.wait_for_timeout(200)
    assert await selected_count() == 3, "Expected selected count to reach 3 before over-cap click"
    attempted = False
    for idx in range(cb_count):
        cb = checkbox_locator.nth(idx)
        if not await cb.is_checked():
            await cb.click(force=True)
            attempted = True
            await page.wait_for_timeout(500)
            break
    assert attempted, "No unchecked 4th assignment available"
    assert await selected_count() == 3 and "3 / 3 selected" in await page.get_by_test_id("assign-count").inner_text(), "UI cap failed"
    print("PASS: AssignModal UI prevents selecting a 4th doctor/service")
    await page.keyboard.press("Escape")

    await page.goto(f"{base}/provider/queue", wait_until="networkidle")
    await page.get_by_test_id("queue-walkin-btn").click()
    await page.get_by_test_id("walkin-name").wait_for(state="visible", timeout=10000)
    assert await page.get_by_test_id("walkin-vehicle-reg").is_visible(), "Automobile missing vehicle reg input"
    assert await page.get_by_test_id("walkin-vehicle-model").is_visible(), "Automobile missing vehicle model input"
    print("PASS: Automobile provider queue walk-in modal shows vehicle inputs")
    await page.get_by_test_id("walkin-close-btn").click()

    await pin_login("9000000101")
    await page.goto(f"{base}/provider/queue", wait_until="networkidle")
    await page.get_by_test_id("queue-walkin-btn").click()
    await page.get_by_test_id("walkin-name").wait_for(state="visible", timeout=10000)
    assert await page.get_by_test_id("walkin-vehicle-reg").count() == 0, "Non-Automobile should not render vehicle reg input"
    assert await page.get_by_test_id("walkin-vehicle-model").count() == 0, "Non-Automobile should not render vehicle model input"
    print("PASS: Non-Automobile provider queue walk-in modal hides vehicle inputs")
    await page.get_by_test_id("walkin-close-btn").click()

    await page.goto(f"{base}/provider/services", wait_until="networkidle")
    svc_type = page.get_by_test_id("service-type-input")
    await svc_type.wait_for(state="attached", timeout=15000)
    svc_class = await svc_type.get_attribute("class") or ""
    assert "hidden" in svc_class.split(), f"Non-Automobile service-type input missing hidden class: {svc_class}"
    print("PASS: Non-Automobile ProviderServices service-type input has hidden class")
    await print_error_messages()
    print("ALL BUG38 UI CHECKS PASSED")
except Exception as e:
    print(f"FAIL: bug38 UI automation failed: {e}")
    raise
'''