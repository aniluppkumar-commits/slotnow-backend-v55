"""Reference Playwright script for iteration 37 focused bug verification.

The browser automation tool executes an equivalent body inside its own async
function with an injected `page` object. Keeping this artifact wrapped avoids
top-level-await lint errors while preserving the tested steps for handoff.
"""


async def run(page):
    await page.set_viewport_size({"width": 1920, "height": 1080})
    page.set_default_timeout(15000)

    base = "https://slotnow-web.preview.emergentagent.com"
    print("STEP 1: Login hospital provider through API and seed UI preconditions")
    login_resp = await page.request.post(
        f"{base}/api/auth/pin-login",
        data={"phone": "919000000007", "role": "provider", "pin": "1234"},
    )
    print(f"login status={login_resp.status}")
    login_data = await login_resp.json()
    token = login_data["token"]

    auth_headers = {"Authorization": f"Bearer {token}"}
    staff_resp = await page.request.get(f"{base}/api/providers/me/staff", headers=auth_headers)
    staff = await staff_resp.json()
    print(f"staff count={len(staff)}")
    if len(staff) < 4:
        raise Exception("Need at least 4 staff rows to prove 4th checkbox is blocked")

    assistant_resp = await page.request.post(
        f"{base}/api/providers/me/assistants",
        headers=auth_headers,
        data={"name": "QA Assign Tester", "phone": "9000007737", "designation": "QA"},
    )
    qa_assistant = await assistant_resp.json()
    await page.request.put(
        f"{base}/api/providers/me/assistants/{qa_assistant['id']}/staff",
        headers=auth_headers,
        data={"staff_ids": []},
    )

    await page.goto(base)
    await page.evaluate(
        """(auth) => {
            localStorage.setItem('slotnow_token', auth.token);
            localStorage.setItem('slotnow_user', JSON.stringify(auth.user));
        }""",
        {"token": token, "user": login_data["user"]},
    )

    print("STEP 2: Verify /provider/assistants visible Assign flow")
    await page.goto(f"{base}/provider/assistants", wait_until="networkidle")
    await page.wait_for_selector(f'[data-testid="assistant-item-{qa_assistant["id"]}"]')
    row = page.locator(f'[data-testid="assistant-item-{qa_assistant["id"]}"]')
    row_text = await row.inner_text()
    print(f"QA assistant row text: {row_text}")

    assign_button = page.locator(f'[data-testid="assistant-assign-{qa_assistant["id"]}"]')
    if not await assign_button.is_visible():
        raise Exception("Assistant Assign button is not visible")
    assign_label = (await assign_button.inner_text()).strip()
    print(f"Assign button label='{assign_label}'")
    if "Assign" not in assign_label:
        raise Exception("Assign button is not labeled with text 'Assign'")

    mapping = page.locator(f'[data-testid="assistant-mapping-{qa_assistant["id"]}"]')
    mapping_text = await mapping.inner_text()
    print(f"initial mapping text='{mapping_text}'")
    if "Mapped to 0 / 3 doctors/services" not in mapping_text:
        raise Exception("Initial mapping-count line is missing or incorrect")

    await assign_button.click(force=True)
    await page.wait_for_selector('[data-testid="assign-count"]')
    count = page.locator('[data-testid="assign-count"]')
    initial_count = await count.inner_text()
    print(f"modal initial count='{initial_count}'")
    if "0 / 3 selected" not in initial_count:
        raise Exception("Assign modal did not start with 0 / 3 selected")

    for i, sid in enumerate([s["id"] for s in staff[:3]], start=1):
        await page.locator(f'[data-testid="assign-{sid}"]').click(force=True)
        await page.wait_for_timeout(200)
        current = await count.inner_text()
        print(f"after checking {i}: {current}")
        if f"{i} / 3 selected" not in current:
            raise Exception(f"Assign counter did not update to {i} / 3")

    await page.locator(f'[data-testid="assign-{staff[3]["id"]}"]').click(force=True)
    await page.wait_for_timeout(500)
    after_fourth = await count.inner_text()
    print(f"after attempted fourth selection count='{after_fourth}'")
    if "3 / 3 selected" not in after_fourth:
        raise Exception("4th selection was not blocked; count changed from 3 / 3")

    error_text = await page.evaluate(
        """() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }"""
    )
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")
    page_body = await page.locator("body").inner_text()
    if "at most 3 doctors/services" not in page_body:
        raise Exception("Blocking the 4th checkbox did not show the expected toast text")

    await page.locator('[data-testid="assign-save"]').click(force=True)
    await page.wait_for_timeout(1000)
    await page.reload(wait_until="networkidle")
    persisted_mapping = await page.locator(
        f'[data-testid="assistant-mapping-{qa_assistant["id"]}"]'
    ).inner_text()
    print(f"persisted mapping after reload='{persisted_mapping}'")
    if "Mapped to 3 / 3 doctors/services" not in persisted_mapping:
        raise Exception("Saved assignment did not persist to row after reload")
    await row.screenshot(path="/app/test_reports/assistant_assign_fixed_surface_iter37.jpg", quality=40)
    print("PASS assistants UI flow")

    print("STEP 3: Verify /provider/availability hospital callout")
    await page.goto(f"{base}/provider/availability", wait_until="networkidle")
    await page.wait_for_timeout(1000)
    callout = page.locator('[data-testid="availability-hospital-callout"]')
    callout_count = await callout.count()
    print(f"availability callout count={callout_count}")
    await page.screenshot(path="/app/test_reports/availability_surface_iter37.jpg", quality=40, full_page=False)
    if callout_count == 0 or not await callout.first.is_visible():
        page_text = await page.locator("body").inner_text()
        print("FAIL availability hospital callout missing. Page starts with:")
        print(page_text[:1000])
    else:
        callout_text = await callout.first.inner_text()
        print(f"callout text='{callout_text}'")
        if "default" not in callout_text.lower():
            raise Exception("Callout visible but does not mention default schedule")
        await page.locator('[data-testid="availability-goto-staff"]').click(force=True)
        await page.wait_for_url("**/provider/staff")
        print("goto staff button navigated to /provider/staff")
        await page.goto(f"{base}/provider/availability", wait_until="networkidle")
        await page.locator('[data-testid="availability-goto-grid"]').click(force=True)
        await page.wait_for_url("**/provider/schedule-grid")
        print("goto grid button navigated to /provider/schedule-grid")

    print("STEP 4: Verify staff schedule link and bulk schedule grid are reachable")
    first_staff_id = staff[0]["id"]
    await page.goto(f"{base}/provider/staff", wait_until="networkidle")
    sched_link = page.locator(f'[data-testid="staff-schedule-{first_staff_id}"]')
    await sched_link.click(force=True)
    await page.wait_for_url(f"**/provider/staff/{first_staff_id}/schedule")
    await page.wait_for_selector('[data-testid="sched-add-btn"]')
    await page.wait_for_selector('[data-testid="ov-add-btn"]')
    print("PASS per-doctor/private schedule page reachable and exposes weekly + override controls")

    await page.goto(f"{base}/provider/schedule-grid", wait_until="networkidle")
    await page.wait_for_selector('[data-testid="schedule-grid"]')
    await page.locator(f'[data-testid="grid-add-{first_staff_id}-1"]').click(force=True)
    await page.wait_for_selector('[data-testid="grid-add-modal"]')
    print("PASS bulk schedule grid reachable and add-shift modal opens")