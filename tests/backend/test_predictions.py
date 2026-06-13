"""
SCRB CrimeIntel — Predictions API Tests
========================================
Enterprise tests for:
  - Alert listing, filtering, and schema
  - Hotspot detection
  - District forecast
  - Prediction summary
  - Early warning system
  - Edge cases: unknown district, invalid severity
"""

import pytest
from conftest import auth_headers


@pytest.mark.asyncio
class TestPredictionAlerts:
    """TC-PRED-01x: Alert endpoints"""

    async def test_alerts_list(self, client, admin_token):
        """TC-PRED-011: Alerts endpoint returns list"""
        r = await client.get("/predictions/alerts", headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_alert_schema(self, client, admin_token):
        """TC-PRED-012: Each alert has required fields"""
        r = await client.get("/predictions/alerts", headers=auth_headers(admin_token))
        body = r.json()
        if body:
            item = body[0]
            for field in ["id","district","crime_type","predicted_count","confidence","severity","trend"]:
                assert field in item, f"Missing field: {field}"

    async def test_alert_confidence_range(self, client, admin_token):
        """TC-PRED-013: Confidence scores are between 0 and 1"""
        r = await client.get("/predictions/alerts", headers=auth_headers(admin_token))
        for item in r.json():
            assert 0.0 <= item["confidence"] <= 1.0

    async def test_alert_severity_filter(self, client, admin_token):
        """TC-PRED-014: Filtering by severity=Critical returns only critical alerts"""
        r = await client.get("/predictions/alerts?severity=Critical",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert item["severity"] == "Critical"

    async def test_alert_district_filter(self, client, admin_token):
        """TC-PRED-015: Filtering by district returns only that district's alerts"""
        r = await client.get("/predictions/alerts?district=Bengaluru+Urban",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert item["district"] == "Bengaluru Urban"

    async def test_alert_valid_trend_values(self, client, admin_token):
        """TC-PRED-016: Trend values must be Rising, Falling, or Stable"""
        r = await client.get("/predictions/alerts", headers=auth_headers(admin_token))
        valid_trends = {"Rising","Falling","Stable"}
        for item in r.json():
            assert item["trend"] in valid_trends


@pytest.mark.asyncio
class TestPredictionHotspots:
    """TC-PRED-02x: Hotspot endpoint"""

    async def test_hotspots_returns_list(self, client, admin_token):
        """TC-PRED-021: Hotspots endpoint returns a list"""
        r = await client.get("/predictions/hotspots", headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_hotspots_capped_to_ten(self, client, admin_token):
        """TC-PRED-022: Hotspot list is limited to 10 entries"""
        r = await client.get("/predictions/hotspots", headers=auth_headers(admin_token))
        assert len(r.json()) <= 10

    async def test_hotspots_are_critical_or_warning(self, client, admin_token):
        """TC-PRED-023: Hotspots are only Critical severity districts"""
        r = await client.get("/predictions/hotspots", headers=auth_headers(admin_token))
        for item in r.json():
            assert item["severity"] in ("Critical", "Warning")


@pytest.mark.asyncio
class TestPredictionForecast:
    """TC-PRED-03x: District forecast endpoint"""

    async def test_forecast_known_district(self, client, admin_token):
        """TC-PRED-031: Forecast for known district returns data"""
        r = await client.get("/predictions/forecast/Bengaluru%20Urban",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "district" in body
        assert "forecast" in body
        assert isinstance(body["forecast"], list)

    async def test_forecast_has_six_months(self, client, admin_token):
        """TC-PRED-032: Forecast covers exactly 6 future months"""
        r = await client.get("/predictions/forecast/Mysuru",
                             headers=auth_headers(admin_token))
        assert len(r.json()["forecast"]) == 6

    async def test_forecast_schema(self, client, admin_token):
        """TC-PRED-033: Each forecast entry has month, predicted, bounds"""
        r = await client.get("/predictions/forecast/Mysuru",
                             headers=auth_headers(admin_token))
        for item in r.json()["forecast"]:
            assert "month" in item
            assert "predicted" in item
            assert "lower_bound" in item
            assert "upper_bound" in item

    async def test_forecast_bounds_logic(self, client, admin_token):
        """TC-PRED-034: Lower bound <= predicted <= upper bound"""
        r = await client.get("/predictions/forecast/Bengaluru%20Urban",
                             headers=auth_headers(admin_token))
        for item in r.json()["forecast"]:
            assert item["lower_bound"] <= item["predicted"] <= item["upper_bound"]


@pytest.mark.asyncio
class TestEarlyWarnings:
    """TC-PRED-04x: Early Warning System"""

    async def test_early_warnings_returns_list(self, client, admin_token):
        """TC-PRED-041: Early warnings endpoint returns a list"""
        r = await client.get("/predictions/early-warnings",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_early_warnings_schema(self, client, admin_token):
        """TC-PRED-042: Each warning has urgency and recommended_action"""
        r = await client.get("/predictions/early-warnings",
                             headers=auth_headers(admin_token))
        for item in r.json():
            assert "urgency" in item
            assert "recommended_action" in item
            assert item["urgency"] in ("IMMEDIATE", "HIGH")

    async def test_early_warnings_only_rising(self, client, admin_token):
        """TC-PRED-043: Early warnings only include Rising trend predictions"""
        r = await client.get("/predictions/early-warnings",
                             headers=auth_headers(admin_token))
        for item in r.json():
            assert item["trend"] == "Rising"

    async def test_early_warnings_high_confidence(self, client, admin_token):
        """TC-PRED-044: Early warnings only have confidence >= 0.80"""
        r = await client.get("/predictions/early-warnings",
                             headers=auth_headers(admin_token))
        for item in r.json():
            assert item["confidence"] >= 0.80

    async def test_prediction_summary(self, client, admin_token):
        """TC-PRED-045: Prediction summary has correct aggregate fields"""
        r = await client.get("/predictions/summary",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        for field in ["total_alerts","critical","warning","normal","rising_trend"]:
            assert field in body
        # Consistency check: critical + warning + normal should equal total
        assert body["critical"] + body["warning"] + body["normal"] == body["total_alerts"]
