"""Playwright browser smoke tests for the real, unauthenticated Next.js UI.

Start the web app separately. No test accounts or authentication mocks are used.
"""
import os
import re
from pathlib import Path

import pytest
from playwright.sync_api import expect, sync_playwright

BASE_URL = os.getenv("FRESHLENS_UI_URL", "http://127.0.0.1:3107")
OUTPUT = Path(os.getenv("FRESHLENS_UI_OUTPUT", "runs/test-evidence/playwright-ui"))


@pytest.fixture(scope="session")
def browser():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        (OUTPUT / "browser-version.txt").write_text(browser.version + "\n")
        yield browser
        browser.close()


@pytest.fixture
def page(browser, request):
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.set_default_timeout(15000)
    yield page
    page.screenshot(path=str(OUTPUT / f"{request.node.name}.png"), full_page=True)
    context.close()


def login(page):
    page.goto(f"{BASE_URL}/login")
    expect(page.get_by_role("heading", name="Welcome back")).to_be_visible()


def test_login_page_renders_accessible_controls(page):
    login(page)
    expect(page).to_have_title(re.compile("Admin sign in"))
    expect(page.get_by_label("Email address")).to_be_enabled()
    expect(page.get_by_label("Password", exact=True)).to_have_attribute("type", "password")
    expect(page.get_by_role("button", name="Sign in to admin workspace")).to_be_enabled()


def test_empty_submission_shows_field_errors(page):
    login(page)
    page.get_by_role("button", name="Sign in to admin workspace").click()
    expect(page.get_by_text("Enter a valid administrator email.", exact=True)).to_be_visible()
    expect(page.get_by_text("Enter your password.", exact=True)).to_be_visible()
    expect(page.get_by_label("Email address")).to_have_attribute("aria-invalid", "true")
    expect(page.get_by_label("Password", exact=True)).to_have_attribute("aria-invalid", "true")
    expect(page).to_have_url(re.compile(r"/login$"))


def test_malformed_email_is_rejected_before_authentication(page):
    login(page)
    page.get_by_label("Email address").fill("invalid-email")
    page.get_by_label("Password", exact=True).fill("local-ui-example")
    page.get_by_role("button", name="Sign in to admin workspace").click()
    expect(page.get_by_text("Enter a valid administrator email.", exact=True)).to_be_visible()
    expect(page.get_by_label("Email address")).to_have_attribute("aria-invalid", "true")
    expect(page.get_by_label("Password", exact=True)).to_have_attribute("aria-invalid", "false")


def test_password_visibility_can_be_toggled_without_losing_value(page):
    login(page)
    password = page.get_by_label("Password", exact=True)
    password.fill("local-ui-example")
    page.get_by_role("button", name="Show password", exact=True).click()
    expect(password).to_have_attribute("type", "text")
    expect(password).to_have_value("local-ui-example")
    page.get_by_role("button", name="Hide password", exact=True).click()
    expect(password).to_have_attribute("type", "password")
    expect(password).to_have_value("local-ui-example")


def test_unauthenticated_dashboard_redirects_to_login(page):
    page.goto(f"{BASE_URL}/dashboard")
    expect(page).to_have_url(re.compile(r"/login$"))
    expect(page.get_by_role("heading", name="Welcome back")).to_be_visible()


def test_session_expired_route_displays_sign_in_notice(page):
    page.goto(f"{BASE_URL}/session-expired")
    expect(page).to_have_url(re.compile(r"/login\?reason=session-expired$"))
    expect(page.get_by_role("alert")).to_contain_text("Your session has expired")
    expect(page.get_by_role("button", name="Sign in to admin workspace")).to_be_enabled()


def test_mobile_width_login_has_no_horizontal_overflow(page):
    page.set_viewport_size({"width": 390, "height": 844})
    login(page)
    page.get_by_label("Email address").fill("invalid-email")
    submit = page.get_by_role("button", name="Sign in to admin workspace")
    submit.scroll_into_view_if_needed()
    expect(submit).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    box = submit.bounding_box()
    assert box and box["x"] >= 0 and box["x"] + box["width"] <= 390


def test_access_denied_page_links_back_to_login(page):
    page.goto(f"{BASE_URL}/access-denied")
    expect(page.get_by_role("heading", name="Administrator role required")).to_be_visible()
    page.get_by_role("link", name="Return to sign in").click()
    expect(page).to_have_url(re.compile(r"/login$"))
    expect(page.get_by_role("heading", name="Welcome back")).to_be_visible()
