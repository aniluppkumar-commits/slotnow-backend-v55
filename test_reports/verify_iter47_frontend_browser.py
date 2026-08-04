"""Playwright body used by bug-testing agent for Iter47 frontend verification.

The MCP browser runner executes a script with an existing async Playwright
`page` object. This file keeps the same logic in a lintable helper so the test
artifact is readable without relying only on the tool invocation.
"""

import base64
import random
import subprocess
import time

import requests


async def run_iter47_frontend(page):
    await page.set_viewport_size({"width": 1920, "height": 1080})
    base_url = "https://slotnow-web.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    suffix = random.randint(10000, 89999)
    assistant_phone = f"90006{suffix}"
    assistant_phone_12 = f"91{assistant_phone}"
    assistant_name = f"Iter47 UI Assistant {suffix}"
    designation = "Photo Desk QA"

    subprocess.run(
        ["/root/.venv/bin/python", "/app/test_reports/iter47_browser_db_helper.py", "cleanup", assistant_phone],
        check=True,
        capture_output=True,
        text=True,
    )
    print(f"Prepared clean frontend test assistant phone {assistant_phone}")

    await page.goto(f"{base_url}/login?role=provider", wait_until="domcontentloaded")
    await page.evaluate("localStorage.clear(); sessionStorage.clear();")
    await page.goto(f"{base_url}/login?role=provider", wait_until="domcontentloaded")
    print("Login page opened for provider")

    await page.get_by_test_id("login-mode-toggle").click(force=True)
    await page.get_by_test_id("login-phone-input").fill("9000000007")
    await page.get_by_test_id("login-pin-input").fill("1234")
    await page.get_by_test_id("login-pin-submit-btn").click(force=True)
    await page.wait_for_url("**/provider**", timeout=20000)
    print("Provider PIN login succeeded in UI")

    await page.goto(f"{base_url}/provider/assistants", wait_until="domcontentloaded")
    await page.get_by_test_id("assistant-name-input").wait_for(state="visible", timeout=20000)
    await page.get_by_test_id("assistant-photo-input").wait_for(state="attached", timeout=10000)
    await page.get_by_test_id("assistant-photo-pick-btn").wait_for(state="visible", timeout=10000)
    await page.get_by_test_id("assistant-add-btn").wait_for(state="visible", timeout=10000)
    print("Provider assistants form and required photo selectors are present")

    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
    )
    await page.get_by_test_id("assistant-photo-input").set_input_files(
        {"name": "iter47-assistant.png", "mimeType": "image/png", "buffer": png_bytes}
    )
    await page.get_by_test_id("assistant-photo-preview").wait_for(state="visible", timeout=15000)
    preview_src = await page.get_by_test_id("assistant-photo-preview").get_attribute("src")
    if not (preview_src and preview_src.startswith("data:image/")):
        raise AssertionError(f"Photo preview src was not a data image: {preview_src[:40] if preview_src else preview_src}")
    print("Photo file selection produced live preview")

    await page.get_by_test_id("assistant-name-input").fill(assistant_name)
    await page.get_by_test_id("assistant-phone-input").fill(assistant_phone)
    await page.get_by_test_id("assistant-designation-input").fill(designation)
    await page.get_by_test_id("assistant-add-btn").click(force=True)
    row = page.locator('[data-testid^="assistant-item-"]').filter(has_text=assistant_name).first
    await row.wait_for(state="visible", timeout=30000)
    row_photo = row.locator('img[data-testid^="assistant-photo-"]').first
    await row_photo.wait_for(state="visible", timeout=15000)
    row_photo_src = await row_photo.get_attribute("src")
    if not (row_photo_src and row_photo_src.startswith("data:image/")):
        raise AssertionError("Added assistant row did not show uploaded photo")
    print("Submitting add-assistant form succeeded and new row shows photo")

    _ = time.time()  # keeps the module import explicit for audit/debug timestamps
    subprocess.run(
        ["/root/.venv/bin/python", "/app/test_reports/iter47_browser_db_helper.py", "seed", assistant_phone_12],
        check=True,
        capture_output=True,
        text=True,
    )
    login_response = requests.post(
        f"{api_url}/auth/verify-otp",
        json={"phone": assistant_phone_12, "otp": "123456", "role": "receptionist"},
        timeout=20,
    )
    if login_response.status_code != 200:
        raise AssertionError(
            f"Assistant 12-digit API login failed for receptionist hero setup: {login_response.status_code} {login_response.text}"
        )
    login_json = login_response.json()
    if not login_json.get("user", {}).get("photo"):
        raise AssertionError("Assistant login user did not include photo")
    print("Assistant API login using frontend 12-digit phone variant succeeded for UI session setup")

    await page.evaluate(
        """payload => {
            localStorage.setItem('slotnow_token', payload.token);
            localStorage.setItem('slotnow_user', JSON.stringify(payload.user));
        }""",
        {"token": login_json["token"], "user": login_json["user"]},
    )
    await page.goto(f"{base_url}/receptionist", wait_until="domcontentloaded")
    await page.get_by_test_id("receptionist-self-photo").wait_for(state="visible", timeout=20000)
    await page.get_by_test_id("receptionist-self-name").wait_for(state="visible", timeout=10000)
    hero_name = await page.get_by_test_id("receptionist-self-name").inner_text()
    hero_photo_src = await page.get_by_test_id("receptionist-self-photo").get_attribute("src")
    if assistant_name not in hero_name or designation not in hero_name:
        raise AssertionError(f"Receptionist hero text missing name/designation: {hero_name}")
    if not (hero_photo_src and hero_photo_src.startswith("data:image/")):
        raise AssertionError("Receptionist hero photo is missing or not a data image")
    print("Receptionist dashboard hero shows logged-in assistant photo, name, and designation")

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

    print("FRONTEND_ITER47_RESULT: success")
