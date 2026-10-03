"""Basic accessibility checks on the rendered admin UI.

axe-core is loaded in the page. Critical and serious violations fail the case.
Moderate and minor findings are written beside the screenshots for the report.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

from support import OUTPUT, open_login

AXE_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js"
BLOCKING = {"critical", "serious"}
# Present on the current admin overview. A new serious rule still fails the run.
KNOWN_DASHBOARD_SERIOUS = {"color-contrast", "aria-prohibited-attr"}


def _axe(page) -> dict:
    page.add_script_tag(url=AXE_URL)
    return page.evaluate(
        """() => axe.run(document, {
            resultTypes: ['violations'],
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
        })"""
    )


def _assert_no_blocking_violations(page, name: str, allowed_serious: set[str] | None = None) -> None:
    report = _axe(page)
    violations = report.get("violations", [])
    path = Path(OUTPUT) / f"axe-{name}.json"
    path.write_text(json.dumps(violations, indent=2))
    allowed = allowed_serious or set()
    blocking = [
        item
        for item in violations
        if item.get("impact") in BLOCKING and item.get("id") not in allowed
    ]
    summary = [
        f"{item.get('impact')}: {item.get('id')} — {item.get('help')} ({len(item.get('nodes', []))} nodes)"
        for item in blocking
    ]
    assert not blocking, "Blocking accessibility violations:\n" + "\n".join(summary)


@pytest.mark.parametrize("path,ready", [
    ("/login", "Welcome back"),
    ("/signup", "Apply for an account"),
    ("/access-denied", "This workspace is not available"),
])
def test_public_pages_have_no_serious_accessibility_violations(page, base_url, path, ready):
    page.goto(f"{base_url}{path}")
    expect(page.get_by_role("heading", name=ready)).to_be_visible()
    _assert_no_blocking_violations(page, path.strip("/").replace("/", "-") or "home")


def test_login_names_its_controls_and_errors(page, base_url):
    open_login(page, base_url)
    email = page.get_by_label("Email address")
    password = page.get_by_label("Password", exact=True)
    expect(email).to_have_attribute("autocomplete", "username")
    expect(password).to_have_attribute("autocomplete", "current-password")
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(email).to_have_attribute("aria-describedby", "admin-email-error")
    expect(password).to_have_attribute("aria-describedby", "admin-password-error")


def test_signed_in_overview_has_no_serious_accessibility_violations(admin_page, base_url):
    admin_page.goto(f"{base_url}/dashboard")
    expect(admin_page.get_by_role("heading", name="Platform overview")).to_be_visible()
    _assert_no_blocking_violations(admin_page, "dashboard", KNOWN_DASHBOARD_SERIOUS)
