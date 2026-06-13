"""
SCRB CrimeIntel — Playwright E2E Tests (Python sync API)
=========================================================
Same tests as test_e2e.py but using pytest-playwright (Python bindings)
which wraps playwright via Python sync API.
"""
import pytest
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:3000"


def login(page: Page):
    """Helper: login as admin"""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    # Try username input
    page.locator("input").first.fill("admin")
    page.locator("input[type='password']").fill("admin123")
    page.locator("button[type='submit']").click()
    page.wait_for_timeout(3000)


class TestAuthE2E:
    def test_login_page_visible(self, page: Page):
        """TC-E2E-011: Login page renders"""
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        assert page.locator("input[type='password']").count() >= 1

    def test_login_success(self, page: Page):
        """TC-E2E-012: Valid login redirects to dashboard"""
        login(page)
        assert "/dashboard" in page.url or "/login" not in page.url

    def test_bad_login_stays_on_login(self, page: Page):
        """TC-E2E-013: Bad credentials don't redirect to dashboard"""
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.locator("input").first.fill("bad_user")
        page.locator("input[type='password']").fill("bad_pass")
        page.locator("button[type='submit']").click()
        page.wait_for_timeout(2000)
        # Should stay on login or show error
        assert "dashboard" not in page.url or page.locator("[class*='error']").count() > 0


class TestDashboardE2E:
    def test_command_center_loads(self, page: Page):
        """TC-E2E-021: Command Center dashboard renders KPI cards"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        cards = page.locator("[class*='stat-card']").count()
        assert cards >= 3, f"Expected ≥3 stat cards, got {cards}"

    def test_sidebar_navigation(self, page: Page):
        """TC-E2E-022: Sidebar has multiple nav items"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        nav_links = page.locator("[class*='nav-item'], [class*='sidebar'] a").count()
        assert nav_links >= 5

    def test_early_warnings_banner(self, page: Page):
        """TC-E2E-023: Early warning section shows on dashboard"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        content = page.inner_text("body")
        has_warning = "IMMEDIATE" in content or "HIGH" in content or "Warning" in content
        assert has_warning, "No early warning content found"


@pytest.mark.parametrize("path,keyword", [
    ("/dashboard/analytics",    "Analytics"),
    ("/dashboard/predictions",  "Predict"),
    ("/dashboard/offenders",    "Offender"),
    ("/dashboard/network",      "Network"),
    ("/dashboard/sociology",    "Sociolog"),
    ("/dashboard/investigator", "Case"),
    ("/dashboard/financial",    "Financial"),
    ("/dashboard/chat",         "AI"),
])
def test_page_loads(page: Page, path: str, keyword: str):
    """TC-E2E-03x: Every dashboard page loads with correct heading"""
    login(page)
    page.goto(f"{BASE_URL}{path}")
    page.wait_for_load_state("load")   # use 'load' not 'networkidle' — charts keep polling
    page.wait_for_timeout(4000)
    content = page.inner_text("body")
    assert keyword.lower() in content.lower(), \
        f"'{keyword}' not found on {path}. Page: {content[:200]}"



class TestChatE2E:
    def test_chat_input_exists(self, page: Page):
        """TC-E2E-041: Chat input area is present"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard/chat")
        page.wait_for_load_state("networkidle")
        textarea = page.locator("textarea, input[id='chat-input']")
        assert textarea.count() >= 1

    def test_suggested_queries_visible(self, page: Page):
        """TC-E2E-042: Suggested queries appear on chat page"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard/chat")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        chips = page.locator("[class*='suggested-query']").count()
        assert chips >= 1, "No suggested query chips found"

    def test_send_and_receive_message(self, page: Page):
        """TC-E2E-043: Sending a query receives an AI response"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard/chat")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        textarea = page.locator("textarea").first
        textarea.fill("How many crimes were recorded in 2024?")
        page.keyboard.press("Enter")
        page.wait_for_timeout(8000)  # Wait for AI response
        content = page.inner_text("body")
        # Should have response content (more than just the question)
        assert len(content) > 300


class TestFinancialE2E:
    def test_financial_page_kpis(self, page: Page):
        """TC-E2E-071: Financial crime page shows KPI cards"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard/financial")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        cards = page.locator("[class*='stat-card']").count()
        assert cards >= 3

    def test_financial_rupee_amounts(self, page: Page):
        """TC-E2E-072: Financial page displays ₹ amounts"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard/financial")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        content = page.inner_text("body")
        assert "₹" in content or "ACC" in content or "SBI" in content


class TestPredictionsE2E:
    def test_predictions_kpis(self, page: Page):
        """TC-E2E-091: Predictions page shows alert count KPIs"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard/predictions")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        cards = page.locator("[class*='stat-card']").count()
        assert cards >= 3

    def test_predictions_alerts_table(self, page: Page):
        """TC-E2E-092: Alert cards are rendered in predictions page"""
        login(page)
        page.goto(f"{BASE_URL}/dashboard/predictions")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        content = page.inner_text("body")
        # Should have district names in the alerts
        assert "Bengaluru" in content or "Mysuru" in content or "Critical" in content
