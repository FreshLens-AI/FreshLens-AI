"""Playwright fixtures for the deployed FreshLens admin workspace."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))

from provision import (  # noqa: E402
    DisposableAdmin,
    create_disposable_admin,
    create_unprovisioned_user,
    delete_app_user,
    delete_auth_user,
)
from support import BASE_URL, OUTPUT, sign_in  # noqa: E402

expect.set_options(timeout=25000)


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture(scope="session")
def browser():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        launch = playwright.chromium.launch
        try:
            instance = launch(channel="chrome", headless=True)
        except Exception:
            instance = launch(headless=True)
        (OUTPUT / "browser-version.txt").write_text(instance.version + "\n")
        yield instance
        instance.close()


@pytest.fixture
def page(browser, request):
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    tab = context.new_page()
    tab.set_default_timeout(20000)
    yield tab
    if request.node.rep_call.failed if hasattr(request.node, "rep_call") else False:
        tab.screenshot(path=str(OUTPUT / f"FAIL-{request.node.name}.png"), full_page=True)
    else:
        tab.screenshot(path=str(OUTPUT / f"{request.node.name}.png"), full_page=True)
    context.close()


@pytest.fixture(scope="session")
def admin_account() -> DisposableAdmin:
    account = create_disposable_admin()
    yield account
    delete_app_user(account.user_id)
    delete_auth_user(account.user_id)


@pytest.fixture(scope="session")
def unprovisioned_account() -> DisposableAdmin:
    account = create_unprovisioned_user()
    yield account
    delete_auth_user(account.user_id)


@pytest.fixture(scope="session")
def admin_storage(browser, admin_account, base_url):
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    tab = context.new_page()
    tab.set_default_timeout(30000)
    sign_in(tab, base_url, admin_account.email, admin_account.password)
    expect(tab.get_by_role("heading", name="Platform overview")).to_be_visible()
    state = OUTPUT / "admin-storage.json"
    context.storage_state(path=str(state))
    context.close()
    return str(state)


@pytest.fixture
def admin_page(browser, admin_storage, request):
    context = browser.new_context(
        storage_state=admin_storage,
        viewport={"width": 1440, "height": 900},
    )
    tab = context.new_page()
    tab.set_default_timeout(30000)
    yield tab
    tab.screenshot(path=str(OUTPUT / f"{request.node.name}.png"), full_page=True)
    context.close()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    setattr(item, f"rep_{report.when}", report)
