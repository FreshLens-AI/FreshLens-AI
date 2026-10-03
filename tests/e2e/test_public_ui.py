"""Unauthenticated GUI coverage of the deployed admin workspace."""

import re

import pytest
from playwright.sync_api import expect

from support import expect_alert, open_login, sign_in


def test_login_page_renders_labelled_controls(page, base_url):
    open_login(page, base_url)
    expect(page).to_have_title(re.compile("Sign in"))
    expect(page.get_by_role("heading", name="Clear oversight for fresher decisions.")).to_be_visible()
    expect(page.get_by_label("Email address")).to_be_enabled()
    expect(page.get_by_label("Password", exact=True)).to_have_attribute("type", "password")
    expect(page.get_by_role("button", name="Sign in", exact=True)).to_be_enabled()
    expect(page.get_by_role("link", name="Apply for a tenant account")).to_be_visible()


def test_empty_sign_in_shows_field_errors_and_stays_on_login(page, base_url):
    open_login(page, base_url)
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page.get_by_text("Enter a valid administrator email.", exact=True)).to_be_visible()
    expect(page.get_by_text("Enter your password.", exact=True)).to_be_visible()
    expect(page.get_by_label("Email address")).to_have_attribute("aria-invalid", "true")
    expect(page.get_by_label("Password", exact=True)).to_have_attribute("aria-invalid", "true")
    expect(page).to_have_url(re.compile(r"/login$"))


def test_keyboard_submit_rejects_an_empty_form(page, base_url):
    open_login(page, base_url)
    page.get_by_label("Email address").focus()
    page.keyboard.press("Enter")
    expect(page.get_by_text("Enter a valid administrator email.", exact=True)).to_be_visible()
    expect(page).to_have_url(re.compile(r"/login$"))


def test_malformed_email_is_rejected_before_authentication(page, base_url):
    open_login(page, base_url)
    page.get_by_label("Email address").fill("not-an-email")
    page.get_by_label("Password", exact=True).fill("local-ui-example")
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page.get_by_text("Enter a valid administrator email.", exact=True)).to_be_visible()
    expect(page.get_by_label("Password", exact=True)).to_have_attribute("aria-invalid", "false")


def test_password_visibility_toggle_keeps_the_value(page, base_url):
    open_login(page, base_url)
    password = page.get_by_label("Password", exact=True)
    password.fill("local-ui-example")
    page.get_by_role("button", name="Show password", exact=True).click()
    expect(password).to_have_attribute("type", "text")
    expect(password).to_have_value("local-ui-example")
    page.get_by_role("button", name="Hide password", exact=True).click()
    expect(password).to_have_attribute("type", "password")
    expect(password).to_have_value("local-ui-example")


def test_wrong_password_shows_an_alert_and_does_not_enter_the_workspace(page, base_url, admin_account):
    sign_in(page, base_url, admin_account.email, "definitely-not-the-password")
    expect_alert(page, "Incorrect email or password")
    expect(page).to_have_url(re.compile(r"/login$"))
    expect(page.get_by_role("heading", name="Platform overview")).to_have_count(0)


def test_account_without_a_freshlens_role_cannot_open_admin(page, base_url, unprovisioned_account):
    sign_in(page, base_url, unprovisioned_account.email, unprovisioned_account.password)
    expect_alert(page, "Vendor accounts use the FreshLens mobile app")
    expect(page).to_have_url(re.compile(r"/login$"))


def test_home_and_dashboard_redirect_anonymous_visitors_to_login(page, base_url):
    page.goto(f"{base_url}/")
    expect(page).to_have_url(re.compile(r"/login$"))
    page.goto(f"{base_url}/dashboard")
    expect(page).to_have_url(re.compile(r"/login$"))
    expect(page.get_by_role("heading", name="Welcome back")).to_be_visible()


def test_protected_admin_routes_redirect_when_signed_out(page, base_url):
    for path in ("/tenants", "/applications", "/catalogue", "/scans", "/alerts", "/analytics"):
        page.goto(f"{base_url}{path}")
        expect(page).to_have_url(re.compile(r"/login$"))


def test_session_expired_route_explains_why_sign_in_is_required(page, base_url):
    page.goto(f"{base_url}/session-expired")
    expect(page).to_have_url(re.compile(r"/login\?reason=session-expired$"))
    expect_alert(page, "Your session has expired")


def test_access_denied_page_returns_to_sign_in(page, base_url):
    page.goto(f"{base_url}/access-denied")
    expect(page.get_by_role("heading", name="This workspace is not available")).to_be_visible()
    page.get_by_role("link", name="Return to sign in").click()
    expect(page).to_have_url(re.compile(r"/login$"))


def test_unknown_route_sends_anonymous_visitors_to_login(page, base_url):
    page.goto(f"{base_url}/this-route-does-not-exist")
    expect(page).to_have_url(re.compile(r"/login$"))
    expect(page.get_by_role("heading", name="Welcome back")).to_be_visible()


def test_signup_page_rejects_an_empty_application_without_calling_the_api(page, base_url):
    page.goto(f"{base_url}/signup")
    expect(page.get_by_role("heading", name="Apply for an account")).to_be_visible()
    page.get_by_role("button", name="Submit for review").click()
    expect_alert(page, "Check the highlighted fields.")
    expect(page.get_by_text("Enter your store or organization name.", exact=True)).to_be_visible()
    expect(page.get_by_text("Enter the tenant owner's name.", exact=True)).to_be_visible()
    expect(page.get_by_text("Enter a valid email address.", exact=True)).to_be_visible()
    expect(page.get_by_text("Application received")).to_have_count(0)


def test_signup_rejects_a_short_phone_and_links_back_to_sign_in(page, base_url):
    page.goto(f"{base_url}/signup")
    page.get_by_label("Store or organization").fill("E2E Grocer")
    page.get_by_label("Owner name").fill("Eval Owner")
    page.get_by_label("Owner email").fill("owner@example.com")
    page.get_by_label("Phone (optional)").fill("123")
    page.get_by_role("button", name="Submit for review").click()
    expect(page.get_by_text("Enter a valid phone number or leave it blank.", exact=True)).to_be_visible()
    page.get_by_role("link", name="Sign in").click()
    expect(page).to_have_url(re.compile(r"/login$"))


def test_set_password_without_an_invitation_explains_the_failure(page, base_url):
    page.goto(f"{base_url}/set-password")
    expect(page.get_by_role("heading", name="Create your password")).to_be_visible()
    expect(page.get_by_text("This invitation is invalid or has expired.")).to_be_visible()


def test_narrow_login_has_no_horizontal_overflow(page, base_url):
    page.set_viewport_size({"width": 390, "height": 844})
    open_login(page, base_url)
    submit = page.get_by_role("button", name="Sign in", exact=True)
    submit.scroll_into_view_if_needed()
    expect(submit).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    box = submit.bounding_box()
    assert box is not None
    assert box["x"] >= 0
    assert box["x"] + box["width"] <= 390


@pytest.mark.parametrize(
    "path",
    ["/login", "/signup", "/access-denied"],
)
def test_public_pages_expose_a_main_heading(page, base_url, path):
    page.goto(f"{base_url}{path}")
    expect(page.get_by_role("heading").first).to_be_visible()
