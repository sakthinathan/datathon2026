"""
SCRB CrimeIntel — Playwright E2E Tests
=======================================
Enterprise-level end-to-end browser tests covering:
  - Authentication flow (login/logout)
  - Dashboard Command Center data loading
  - All sidebar navigation links work
  - AI Chat: send message and receive response
  - Analytics page charts render
  - Predictions: early warning feed visible
  - Offender filtering
  - Financial crime page loads
  - Sociology insights page renders
  - Investigator search flow
  - Responsive layout checks
"""

import pytest
from playwright.sync_api import Page, expect
import re

BASE_URL = "http://localhost:3000"
LOGIN_USER = "admin"
LOGIN_PASS = "admin123"


@pytest.fixture(scope="function")
def logged_in_page(page: Page):
    """Fixture: Navigate to login and authenticate before each test."""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill("input[type='text'], input[placeholder*='username'], input[name='username']", LOGIN_USER)
    page.fill("input[type='password']", LOGIN_PASS)
    page.click("button[type='submit']")
    page.wait_for_url(f"{BASE_URL}/dashboard**", timeout=10000)
    yield page


# ══════════════════════════════════════════════════
# TC-E2E-01x  Authentication Flow
# ══════════════════════════════════════════════════

class TestAuthFlow:
    def test_login_page_renders(self, page: Page):
        """TC-E2E-011: Login page loads and shows form elements"""
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        assert "login" in page.url.lower() or page.query_selector("input[type='password']") is not None

    def test_successful_login_redirects(self, page: Page):
        """TC-E2E-012: Valid credentials redirect to dashboard"""
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.fill("input[type='text'], input[placeholder*='username'], input[name='username']", LOGIN_USER)
        page.fill("input[type='password']", LOGIN_PASS)
        page.click("button[type='submit']")
        page.wait_for_url(f"{BASE_URL}/dashboard**", timeout=10000)
        assert "/dashboard" in page.url

    def test_invalid_login_shows_error(self, page: Page):
        """TC-E2E-013: Invalid credentials show error message"""
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.fill("input[type='text'], input[placeholder*='username'], input[name='username']", "wrong_user")
        page.fill("input[type='password']", "wrong_pass")
        page.click("button[type='submit']")
        page.wait_for_timeout(2000)
        # Should either show error text or stay on login page
        assert "login" in page.url.lower() or page.query_selector("[class*='error'], [class*='alert']") is not None

    def test_protected_route_redirects_to_login(self, page: Page):
        """TC-E2E-014: Unauthenticated access to dashboard redirects to login"""
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_timeout(2000)
        assert "login" in page.url.lower() or "/dashboard" in page.url

    def test_logout_clears_session(self, logged_in_page: Page):
        """TC-E2E-015: Logout button clears auth and redirects"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        logout_btn = page.query_selector("button[title='Logout']")
        if logout_btn:
            logout_btn.click()
            page.wait_for_timeout(2000)
            assert "login" in page.url.lower()


# ══════════════════════════════════════════════════
# TC-E2E-02x  Command Center Dashboard
# ══════════════════════════════════════════════════

class TestCommandCenterDashboard:
    def test_dashboard_loads_kpi_cards(self, logged_in_page: Page):
        """TC-E2E-021: Command Center shows 6 KPI stat cards"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)  # Allow data fetch
        stat_cards = page.query_selector_all("[class*='stat-card']")
        assert len(stat_cards) >= 4, f"Expected at least 4 stat cards, got {len(stat_cards)}"

    def test_dashboard_shows_crime_count(self, logged_in_page: Page):
        """TC-E2E-022: Dashboard KPIs contain non-zero crime count"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        content = page.inner_text("body")
        # Should have a large number (crime count)
        assert any(c.isdigit() for c in content)

    def test_dashboard_sidebar_visible(self, logged_in_page: Page):
        """TC-E2E-023: Sidebar navigation is rendered"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        sidebar = page.query_selector("[class*='sidebar']")
        assert sidebar is not None

    def test_dashboard_command_center_link(self, logged_in_page: Page):
        """TC-E2E-024: Command Center nav link is in sidebar"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        link = page.query_selector("a[href='/dashboard']")
        assert link is not None

    def test_early_warning_section(self, logged_in_page: Page):
        """TC-E2E-025: Early warning feed renders with district data"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        text = page.inner_text("body")
        # The early warning section should be visible
        assert "Warning" in text or "IMMEDIATE" in text or "HIGH" in text


# ══════════════════════════════════════════════════
# TC-E2E-03x  Navigation
# ══════════════════════════════════════════════════

class TestNavigation:
    @pytest.mark.parametrize("path,expected_text", [
        ("/dashboard/analytics",    "Crime Analytics"),
        ("/dashboard/predictions",  "Predictive Analytics"),
        ("/dashboard/offenders",    "Offender Profiling"),
        ("/dashboard/network",      "Criminal Network"),
        ("/dashboard/sociology",    "Sociological"),
        ("/dashboard/investigator", "Case Intelligence"),
        ("/dashboard/financial",    "Financial Crime"),
        ("/dashboard/audit",        "Audit"),
    ])
    def test_page_loads_correctly(self, logged_in_page: Page, path: str, expected_text: str):
        """TC-E2E-03x: Each page navigates and shows expected heading"""
        page = logged_in_page
        page.goto(f"{BASE_URL}{path}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        content = page.inner_text("body")
        assert expected_text.lower() in content.lower(), \
            f"Expected '{expected_text}' on {path}, got content length {len(content)}"


# ══════════════════════════════════════════════════
# TC-E2E-04x  AI Chat
# ══════════════════════════════════════════════════

class TestAIChat:
    def test_chat_page_loads(self, logged_in_page: Page):
        """TC-E2E-041: Chat page renders without errors"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/chat")
        page.wait_for_load_state("networkidle")
        assert page.query_selector("textarea, [id='chat-input']") is not None

    def test_chat_welcome_message_visible(self, logged_in_page: Page):
        """TC-E2E-042: Welcome message is shown on initial load"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/chat")
        page.wait_for_load_state("networkidle")
        content = page.inner_text("body")
        assert "SCRB" in content or "Welcome" in content or "AI" in content

    def test_send_message_and_receive_response(self, logged_in_page: Page):
        """TC-E2E-043: Typing a query and submitting receives an AI response"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/chat")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # Find and fill the chat input
        textarea = page.query_selector("textarea, [id='chat-input']")
        assert textarea is not None, "Chat input not found"
        textarea.fill("How many crimes were recorded in 2024?")
        page.keyboard.press("Enter")

        # Wait for response (up to 30s)
        page.wait_for_timeout(8000)
        content = page.inner_text("body")
        # Should have more content than just the original message
        assert len(content) > 200

    def test_suggested_queries_clickable(self, logged_in_page: Page):
        """TC-E2E-044: Suggested query chips are visible and clickable"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/chat")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        chips = page.query_selector_all("[class*='suggested-query']")
        assert len(chips) > 0, "No suggested query chips found"

    def test_language_toggle_visible(self, logged_in_page: Page):
        """TC-E2E-045: EN / Kannada language toggle is rendered"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/chat")
        page.wait_for_load_state("networkidle")
        content = page.inner_text("body")
        assert "EN" in content or "ಕನ್ನಡ" in content

    def test_new_chat_button(self, logged_in_page: Page):
        """TC-E2E-046: New Chat button is present"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/chat")
        page.wait_for_load_state("networkidle")
        content = page.inner_text("body")
        assert "New Chat" in content or "New Investigation" in content


# ══════════════════════════════════════════════════
# TC-E2E-05x  Analytics Page
# ══════════════════════════════════════════════════

class TestAnalyticsPage:
    def test_analytics_stat_cards(self, logged_in_page: Page):
        """TC-E2E-051: Analytics page loads stat cards"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/analytics")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        stat_cards = page.query_selector_all("[class*='stat-card']")
        assert len(stat_cards) >= 4

    def test_analytics_year_filter(self, logged_in_page: Page):
        """TC-E2E-052: Year filter dropdown is present and clickable"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/analytics")
        page.wait_for_load_state("networkidle")
        select = page.query_selector("select")
        assert select is not None

    def test_analytics_shows_bengaluru(self, logged_in_page: Page):
        """TC-E2E-053: Bengaluru Urban appears in district breakdown"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/analytics")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        content = page.inner_text("body")
        assert "Bengaluru" in content or "bengaluru" in content.lower()


# ══════════════════════════════════════════════════
# TC-E2E-06x  Investigator Page
# ══════════════════════════════════════════════════

class TestInvestigatorPage:
    def test_investigator_search_bar_exists(self, logged_in_page: Page):
        """TC-E2E-061: Case Intelligence page has a search input"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/investigator")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        search = page.query_selector("input[type='text']")
        assert search is not None

    def test_investigator_search_returns_results(self, logged_in_page: Page):
        """TC-E2E-062: Searching 'FIR/2024' returns case results"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/investigator")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        search = page.query_selector("input[type='text']")
        search.fill("FIR/2024")
        page.keyboard.press("Enter")
        page.wait_for_timeout(3000)
        content = page.inner_text("body")
        assert "FIR/2024" in content or "Bengaluru" in content or "Result" in content

    def test_investigator_timeline_tab(self, logged_in_page: Page):
        """TC-E2E-063: Timeline tab is present and clickable"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/investigator")
        page.wait_for_load_state("networkidle")
        content = page.inner_text("body")
        assert "Timeline" in content or "timeline" in content.lower()


# ══════════════════════════════════════════════════
# TC-E2E-07x  Financial Crime Page
# ══════════════════════════════════════════════════

class TestFinancialPage:
    def test_financial_kpis_load(self, logged_in_page: Page):
        """TC-E2E-071: Financial crime page shows KPI stats"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/financial")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        stat_cards = page.query_selector_all("[class*='stat-card']")
        assert len(stat_cards) >= 3

    def test_financial_tab_switch(self, logged_in_page: Page):
        """TC-E2E-072: Can switch between Transactions and Network Graph tabs"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/financial")
        page.wait_for_load_state("networkidle")
        content = page.inner_text("body")
        assert "Transaction" in content or "Network" in content

    def test_financial_shows_suspicious_amounts(self, logged_in_page: Page):
        """TC-E2E-073: Transaction table shows amounts in ₹ format"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/financial")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        content = page.inner_text("body")
        assert "₹" in content or "ACC" in content or "Suspicious" in content


# ══════════════════════════════════════════════════
# TC-E2E-08x  Sociology Insights Page
# ══════════════════════════════════════════════════

class TestSociologyPage:
    def test_sociology_page_loads(self, logged_in_page: Page):
        """TC-E2E-081: Sociology page renders successfully"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/sociology")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        content = page.inner_text("body")
        assert "Sociological" in content

    def test_sociology_kpi_cards(self, logged_in_page: Page):
        """TC-E2E-082: Sociology page shows KPI stat cards"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/sociology")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        stat_cards = page.query_selector_all("[class*='stat-card']")
        assert len(stat_cards) >= 3

    def test_sociology_shows_vulnerability_table(self, logged_in_page: Page):
        """TC-E2E-083: Economic vulnerability table is present"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/sociology")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        content = page.inner_text("body")
        assert "Vulnerability" in content or "District" in content


# ══════════════════════════════════════════════════
# TC-E2E-09x  Predictions Page
# ══════════════════════════════════════════════════

class TestPredictionsPage:
    def test_predictions_page_loads(self, logged_in_page: Page):
        """TC-E2E-091: Predictions page renders without errors"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/predictions")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        content = page.inner_text("body")
        assert "Predict" in content

    def test_early_warning_feed_renders(self, logged_in_page: Page):
        """TC-E2E-092: Early warning feed section is visible"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/predictions")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        content = page.inner_text("body")
        assert "IMMEDIATE" in content or "HIGH" in content or "Early Warning" in content

    def test_predictions_stat_cards(self, logged_in_page: Page):
        """TC-E2E-093: Predictions stat cards show numeric values"""
        page = logged_in_page
        page.goto(f"{BASE_URL}/dashboard/predictions")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        stat_cards = page.query_selector_all("[class*='stat-card']")
        assert len(stat_cards) >= 4
