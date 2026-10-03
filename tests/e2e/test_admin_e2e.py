"""Authenticated end-to-end journeys through the live admin workspace."""

import re

from playwright.sync_api import expect

from support import sign_in

SECTIONS = (
    ("Overview", "/dashboard", "Platform overview"),
    ("Tenants", "/tenants", "Tenants"),
    ("Applications", "/applications", "Tenant applications"),
    ("Catalogue", "/catalogue", "Product catalogue"),
    ("Scan activity", "/scans", "Scan activity"),
    ("Alerts", "/alerts", "Alerts"),
    ("Analytics", "/analytics", "Analytics"),
)


def test_platform_admin_signs_in_to_the_overview(page, base_url, admin_account):
    sign_in(page, base_url, admin_account.email, admin_account.password)
    expect(page).to_have_url(re.compile(r"/dashboard$"))
    expect(page.get_by_role("heading", name="Platform overview")).to_be_visible()
    expect(page.get_by_label("Platform summary")).to_be_visible()
    expect(page.get_by_label("Platform admin profile")).to_contain_text("E2E Platform Admin")
    expect(page.get_by_role("banner").get_by_text("Admin workspace")).to_be_visible()


def test_primary_navigation_opens_every_admin_section(admin_page, base_url):
    admin_page.goto(f"{base_url}/dashboard")
    expect(admin_page.get_by_role("heading", name="Platform overview")).to_be_visible()
    nav = admin_page.get_by_role("navigation", name="Primary navigation")
    for label, path, heading in SECTIONS:
        nav.get_by_role("link", name=label, exact=True).click()
        expect(admin_page).to_have_url(re.compile(rf"{path}$"))
        expect(admin_page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
        expect(nav.get_by_role("link", name=label, exact=True)).to_have_attribute("aria-current", "page")


def test_skip_link_targets_the_main_content(admin_page, base_url):
    admin_page.goto(f"{base_url}/dashboard")
    skip = admin_page.get_by_role("link", name="Skip to main content")
    expect(skip).to_have_attribute("href", "#main-content")
    expect(admin_page.locator("#main-content")).to_be_visible()


def test_tenant_search_with_no_match_shows_the_empty_state(admin_page, base_url):
    admin_page.goto(f"{base_url}/tenants")
    expect(admin_page.get_by_role("heading", name="Tenants", exact=True)).to_be_visible()
    admin_page.get_by_label("Search tenants").fill("zzzz-no-such-tenant-e2e")
    admin_page.get_by_role("button", name="Apply filters").click()
    expect(admin_page).to_have_url(re.compile(r"/tenants\?"))
    expect(admin_page.get_by_role("heading", name="No tenants match these filters")).to_be_visible()
    admin_page.get_by_role("link", name="Clear filters").first.click()
    expect(admin_page).to_have_url(re.compile(r"/tenants$"))


def test_catalogue_search_reports_how_many_products_match(admin_page, base_url):
    admin_page.goto(f"{base_url}/catalogue")
    expect(admin_page.get_by_role("heading", name="Product catalogue")).to_be_visible()
    admin_page.get_by_label("Search catalogue").fill("zzzz-no-such-product-e2e")
    admin_page.get_by_role("button", name="Search", exact=True).click()
    expect(admin_page.get_by_role("heading", name="No products match this search")).to_be_visible()
    expect(admin_page.get_by_text(re.compile(r"Showing\s+0\s+of"))).to_be_visible()


def test_alert_filters_can_be_applied_and_cleared(admin_page, base_url):
    admin_page.goto(f"{base_url}/alerts")
    expect(admin_page.get_by_role("heading", name="Alerts", exact=True)).to_be_visible()
    expect(admin_page.get_by_label("Alert summary")).to_be_visible()
    admin_page.get_by_label("Type").select_option("spoilage")
    admin_page.get_by_label("Severity").select_option("critical")
    admin_page.get_by_role("button", name="Apply filters").click()
    expect(admin_page).to_have_url(re.compile(r"type=spoilage"))
    expect(admin_page).to_have_url(re.compile(r"severity=critical"))
    heading = admin_page.get_by_role("heading", name=re.compile("Alerts|No alerts match"))
    expect(heading.first).to_be_visible()


def test_analytics_date_range_filter_updates_the_query(admin_page, base_url):
    admin_page.goto(f"{base_url}/analytics")
    expect(admin_page.get_by_role("heading", name="Analytics", exact=True)).to_be_visible()
    expect(admin_page.get_by_label("Analytics filters")).to_be_visible()
    admin_page.get_by_label("Date range").select_option("7")
    admin_page.get_by_role("button", name="Apply filters").click()
    expect(admin_page).to_have_url(re.compile(r"[?&]days=7"))
    expect(admin_page.get_by_label("Analytics summary").get_by_text("last 7 days")).to_be_visible()


def test_refresh_and_alerts_shortcut_stay_available(admin_page, base_url):
    admin_page.goto(f"{base_url}/dashboard")
    refresh = admin_page.get_by_role("button", name="Refresh data")
    expect(refresh).to_be_enabled()
    refresh.click()
    expect(admin_page.get_by_role("heading", name="Platform overview")).to_be_visible()
    admin_page.get_by_role("link", name="View alerts").click()
    expect(admin_page).to_have_url(re.compile(r"/alerts$"))
    expect(admin_page.get_by_role("heading", name="Alerts", exact=True)).to_be_visible()


def test_first_tenant_opens_a_detail_page_when_tenants_exist(admin_page, base_url):
    admin_page.goto(f"{base_url}/tenants")
    view = admin_page.locator("table").get_by_role("link", name=re.compile(r"^View ")).first
    if view.count() == 0:
        expect(admin_page.get_by_role("heading", name="No tenants yet")).to_be_visible()
        return
    view.click()
    expect(admin_page).to_have_url(re.compile(r"/tenants/[0-9a-f-]{36}$"))
    expect(admin_page.get_by_role("heading").first).to_be_visible()
    expect(admin_page.get_by_label("Breadcrumb").get_by_role("link", name="Tenants")).to_be_visible()


def test_mobile_navigation_drawer_reaches_the_catalogue(admin_page, base_url):
    admin_page.set_viewport_size({"width": 390, "height": 844})
    admin_page.goto(f"{base_url}/dashboard")
    admin_page.get_by_role("button", name="Open navigation").click()
    catalogue = admin_page.get_by_role("navigation", name="Primary navigation").get_by_role(
        "link", name="Catalogue", exact=True
    )
    expect(catalogue).to_be_visible()
    catalogue.click()
    expect(admin_page).to_have_url(re.compile(r"/catalogue$"))
    expect(admin_page.get_by_role("heading", name="Product catalogue")).to_be_visible()
    assert admin_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


def test_signed_in_unknown_route_shows_the_workspace_not_found_page(admin_page, base_url):
    admin_page.goto(f"{base_url}/this-route-does-not-exist")
    expect(admin_page.get_by_role("heading", name="This route is not in the admin workspace.")).to_be_visible()
    expect(admin_page.get_by_role("link", name="Return to overview")).to_be_visible()


def test_sign_out_returns_to_login_and_locks_the_dashboard(browser, admin_storage, base_url):
    context = browser.new_context(storage_state=admin_storage, viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.set_default_timeout(30000)
    page.goto(f"{base_url}/dashboard")
    expect(page.get_by_role("heading", name="Platform overview")).to_be_visible()
    page.get_by_role("button", name="Sign out", exact=True).click()
    expect(page).to_have_url(re.compile(r"/login$"))
    expect(page.get_by_role("heading", name="Welcome back")).to_be_visible()
    page.goto(f"{base_url}/dashboard")
    expect(page).to_have_url(re.compile(r"/login$"))
    context.close()
