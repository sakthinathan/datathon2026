"""
SCRB CrimeIntel — Analytics API Tests
======================================
Enterprise-level tests for all /analytics/* endpoints:
  - Overview stats correctness
  - Yearly/monthly trend data shape
  - District and crime-type breakdowns
  - Filters (year, crime type, district)
  - Heatmap data
  - Police stations
  - Time-of-day patterns
  - Edge cases: empty filters, invalid params
"""

import pytest
from conftest import auth_headers


@pytest.mark.asyncio
class TestAnalyticsOverview:
    """TC-ANALYTICS-01x: /analytics/overview endpoint"""

    async def test_overview_returns_200(self, client, admin_token):
        """TC-ANALYTICS-011: Overview endpoint returns HTTP 200"""
        r = await client.get("/analytics/overview", headers=auth_headers(admin_token))
        assert r.status_code == 200

    async def test_overview_required_fields(self, client, admin_token):
        """TC-ANALYTICS-012: Overview contains all required KPI fields"""
        r = await client.get("/analytics/overview", headers=auth_headers(admin_token))
        body = r.json()
        required = ["total_crimes","total_stations","critical_cases",
                    "solved_cases","solve_rate","recent_year_crimes","pending_investigation"]
        for field in required:
            assert field in body, f"Missing field: {field}"

    async def test_overview_solve_rate_range(self, client, admin_token):
        """TC-ANALYTICS-013: Solve rate is a percentage between 0 and 100"""
        r = await client.get("/analytics/overview", headers=auth_headers(admin_token))
        rate = r.json()["solve_rate"]
        assert 0 <= rate <= 100

    async def test_overview_positive_counts(self, client, admin_token):
        """TC-ANALYTICS-014: All count fields are non-negative integers"""
        r = await client.get("/analytics/overview", headers=auth_headers(admin_token))
        body = r.json()
        for field in ["total_crimes","critical_cases","solved_cases"]:
            assert body[field] >= 0


@pytest.mark.asyncio
class TestAnalyticsTrends:
    """TC-ANALYTICS-02x: Trend endpoints"""

    async def test_yearly_trends_list(self, client, admin_token):
        """TC-ANALYTICS-021: Yearly trends returns a non-empty list"""
        r = await client.get("/analytics/trends/yearly", headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) > 0

    async def test_yearly_trends_schema(self, client, admin_token):
        """TC-ANALYTICS-022: Each trend entry has year, total, solved, solve_rate"""
        r = await client.get("/analytics/trends/yearly", headers=auth_headers(admin_token))
        for item in r.json():
            assert "year" in item
            assert "total" in item
            assert "solved" in item
            assert "solve_rate" in item

    async def test_monthly_trends_no_filter(self, client, admin_token):
        """TC-ANALYTICS-023: Monthly trends without year filter returns data"""
        r = await client.get("/analytics/trends/monthly", headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert len(r.json()) > 0

    async def test_monthly_trends_with_year(self, client, admin_token):
        """TC-ANALYTICS-024: Monthly trends filtered by year returns data"""
        r = await client.get("/analytics/trends/monthly?year=2024", headers=auth_headers(admin_token))
        assert r.status_code == 200

    async def test_monthly_trend_month_range(self, client, admin_token):
        """TC-ANALYTICS-025: Monthly numbers are in 1-12 range"""
        r = await client.get("/analytics/trends/monthly", headers=auth_headers(admin_token))
        for item in r.json():
            assert 1 <= item["month_num"] <= 12


@pytest.mark.asyncio
class TestAnalyticsBreakdowns:
    """TC-ANALYTICS-03x: Breakdown endpoints"""

    async def test_by_district_returns_list(self, client, admin_token):
        """TC-ANALYTICS-031: /analytics/by-district returns a list"""
        r = await client.get("/analytics/by-district", headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_by_district_schema(self, client, admin_token):
        """TC-ANALYTICS-032: District data has district, total, critical fields"""
        r = await client.get("/analytics/by-district", headers=auth_headers(admin_token))
        for item in r.json():
            assert "district" in item
            assert "total" in item
            assert "critical" in item

    async def test_by_crime_type_returns_list(self, client, admin_token):
        """TC-ANALYTICS-033: /analytics/by-crime-type returns a list"""
        r = await client.get("/analytics/by-crime-type", headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_severity_distribution(self, client, admin_token):
        """TC-ANALYTICS-034: Severity distribution returns valid severity names"""
        valid_severities = {"Critical", "High", "Medium", "Low"}
        r = await client.get("/analytics/severity-distribution", headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert item["severity"] in valid_severities

    async def test_heatmap_data(self, client, admin_token):
        """TC-ANALYTICS-035: Heatmap data has lat/lon coordinates"""
        r = await client.get("/analytics/heatmap-data", headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert "lat" in item
            assert "lon" in item
            assert "count" in item

    async def test_time_of_day(self, client, admin_token):
        """TC-ANALYTICS-036: Time-of-day data has hours in 0-23 range"""
        r = await client.get("/analytics/time-of-day", headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            if item.get("hour") is not None:
                assert 0 <= item["hour"] <= 23

    async def test_police_stations_returns_list(self, client, admin_token):
        """TC-ANALYTICS-037: Police stations endpoint returns a list"""
        r = await client.get("/analytics/police-stations", headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_police_station_solve_rate_bounds(self, client, admin_token):
        """TC-ANALYTICS-038: Police station solve rate is between 0-100"""
        r = await client.get("/analytics/police-stations", headers=auth_headers(admin_token))
        for s in r.json():
            assert 0 <= s.get("solve_rate", 0) <= 100

    async def test_district_comparison(self, client, admin_token):
        """TC-ANALYTICS-039: District comparison returns data for both districts"""
        r = await client.get("/analytics/district-comparison?d1=Bengaluru+Urban&d2=Mysuru",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "district1" in body
        assert "district2" in body
        assert body["district1"]["name"] == "Bengaluru Urban"
        assert body["district2"]["name"] == "Mysuru"
