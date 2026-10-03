"""Shared Playwright helpers for the FreshLens admin E2E suite."""

from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import expect

BASE_URL = os.environ.get("FRESHLENS_UI_URL", "https://freshlens-admin.vercel.app").rstrip("/")
OUTPUT = Path(os.environ.get("FRESHLENS_E2E_OUTPUT", "runs/test-evidence/e2e-ui"))


def sign_in(page, base_url: str, email: str, password: str) -> None:
    page.goto(f"{base_url}/login")
    page.get_by_label("Email address").fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Sign in", exact=True).click()


def expect_alert(page, text: str) -> None:
    expect(page.get_by_role("alert").filter(has_text=text)).to_be_visible()


def open_login(page, base_url: str) -> None:
    page.goto(f"{base_url}/login")
    expect(page.get_by_role("heading", name="Welcome back")).to_be_visible()
