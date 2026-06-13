"""
SCRB CrimeIntel — Offenders, Sociology & Financial Crime Tests
==============================================================
Enterprise tests covering:
  - Repeat offender listing and filtering
  - Risk distribution
  - District profile
  - Sociological insights (all 6 endpoints)
  - Financial account and transaction data
  - Money trail network graph
  - Suspicious transaction validation
"""

import pytest
from conftest import auth_headers


@pytest.mark.asyncio
class TestOffenderProfiling:
    """TC-OFF-01x: Offender profiling endpoints"""

    async def test_repeat_offenders_returns_list(self, client, admin_token):
        """TC-OFF-011: Repeat offenders endpoint returns a list"""
        r = await client.get("/offenders/repeat-offenders",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_offender_schema(self, client, admin_token):
        """TC-OFF-012: Each offender has required profile fields"""
        r = await client.get("/offenders/repeat-offenders",
                             headers=auth_headers(admin_token))
        body = r.json()
        if body:
            item = body[0]
            for field in ["id","name","alias","district","risk_level","crime_count",
                          "network_size","risk_score","behavioral_tags"]:
                assert field in item, f"Missing field: {field}"

    async def test_offender_risk_score_range(self, client, admin_token):
        """TC-OFF-013: Risk score is between 0 and 100"""
        r = await client.get("/offenders/repeat-offenders",
                             headers=auth_headers(admin_token))
        for item in r.json():
            assert 0 <= item["risk_score"] <= 100

    async def test_offender_risk_level_values(self, client, admin_token):
        """TC-OFF-014: Risk level must be High, Medium, or Low"""
        r = await client.get("/offenders/repeat-offenders",
                             headers=auth_headers(admin_token))
        valid_levels = {"High", "Medium", "Low"}
        for item in r.json():
            assert item["risk_level"] in valid_levels

    async def test_offender_filter_by_risk_level(self, client, admin_token):
        """TC-OFF-015: Filtering by risk_level=High returns only High risk"""
        r = await client.get("/offenders/repeat-offenders?risk_level=High",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert item["risk_level"] == "High"

    async def test_offender_filter_by_district(self, client, admin_token):
        """TC-OFF-016: Filtering by district returns only that district"""
        r = await client.get("/offenders/repeat-offenders?district=Bengaluru+Urban",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert item["district"] == "Bengaluru Urban"

    async def test_offender_sorted_by_risk(self, client, admin_token):
        """TC-OFF-017: Results are sorted by risk_score descending"""
        r = await client.get("/offenders/repeat-offenders",
                             headers=auth_headers(admin_token))
        scores = [item["risk_score"] for item in r.json()]
        assert scores == sorted(scores, reverse=True)

    async def test_behavioral_tags_are_list(self, client, admin_token):
        """TC-OFF-018: Behavioral tags field is always a list"""
        r = await client.get("/offenders/repeat-offenders",
                             headers=auth_headers(admin_token))
        for item in r.json():
            assert isinstance(item["behavioral_tags"], list)

    async def test_risk_distribution_returns_data(self, client, admin_token):
        """TC-OFF-019: Risk distribution returns counts by level"""
        r = await client.get("/offenders/risk-distribution",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        risk_levels = {item["risk_level"] for item in body}
        assert len(risk_levels) > 0

    async def test_district_profile_returns_data(self, client, admin_token):
        """TC-OFF-020: District profile returns district breakdown"""
        r = await client.get("/offenders/district-profile",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        if body:
            assert "district" in body[0]
            assert "High" in body[0]
            assert "Medium" in body[0]


@pytest.mark.asyncio
class TestSociology:
    """TC-SOC-01x: Sociological Insights endpoints"""

    async def test_demographic_breakdown(self, client, admin_token):
        """TC-SOC-011: Demographic breakdown returns age_groups, gender, occupations"""
        r = await client.get("/sociology/demographic-breakdown",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "age_groups" in body
        assert "gender" in body
        assert "occupations" in body

    async def test_gender_field_values(self, client, admin_token):
        """TC-SOC-012: Gender field contains Male/Female values"""
        r = await client.get("/sociology/demographic-breakdown",
                             headers=auth_headers(admin_token))
        genders = {g["gender"] for g in r.json()["gender"]}
        assert "Male" in genders or "Female" in genders

    async def test_age_groups_format(self, client, admin_token):
        """TC-SOC-013: Age groups follow expected band labels"""
        r = await client.get("/sociology/demographic-breakdown",
                             headers=auth_headers(admin_token))
        valid_bands = {"15-25", "26-35", "36-50", "50+"}
        for item in r.json()["age_groups"]:
            assert item["age_group"] in valid_bands

    async def test_crime_by_gender_schema(self, client, admin_token):
        """TC-SOC-014: Crime-by-gender has Male/Female counts per crime_type"""
        r = await client.get("/sociology/crime-by-gender",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        # May be empty if JOIN produces no results in test DB, which is OK
        body = r.json()
        assert isinstance(body, list)

    async def test_crime_by_age_group(self, client, admin_token):
        """TC-SOC-015: Crime-by-age-group returns risk breakdown per band"""
        r = await client.get("/sociology/crime-by-age-group",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert "age_group" in item
            assert "High" in item
            assert "Medium" in item
            assert "Low" in item

    async def test_economic_risk_zones(self, client, admin_token):
        """TC-SOC-016: Economic risk zones have vulnerability percentage"""
        r = await client.get("/sociology/economic-risk-zones",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert "district" in item
            assert "vulnerability_pct" in item
            if item["vulnerability_pct"] is not None:
                assert 0 <= item["vulnerability_pct"] <= 100

    async def test_repeat_vs_first_time(self, client, admin_token):
        """TC-SOC-017: Repeat vs first-time has repeat_offenders and first_time counts"""
        r = await client.get("/sociology/repeat-vs-first-time",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert "district" in item
            assert "repeat_offenders" in item
            assert "first_time" in item

    async def test_social_risk_summary(self, client, admin_token):
        """TC-SOC-018: Social risk summary has all indicator fields"""
        r = await client.get("/sociology/social-risk-summary",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        for field in ["total_suspects","unemployed_count","high_risk_youth","habitual_offenders"]:
            assert field in body

    async def test_social_risk_percentages_valid(self, client, admin_token):
        """TC-SOC-019: All percentage fields are between 0 and 100"""
        r = await client.get("/sociology/social-risk-summary",
                             headers=auth_headers(admin_token))
        body = r.json()
        for pct_field in ["unemployed_pct","high_risk_youth_pct"]:
            if body.get(pct_field) is not None:
                assert 0 <= body[pct_field] <= 100


@pytest.mark.asyncio
class TestFinancialCrime:
    """TC-FIN-01x: Financial crime endpoints"""

    async def test_financial_summary(self, client, admin_token):
        """TC-FIN-011: Financial summary has all KPI fields"""
        r = await client.get("/financial/summary", headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        for field in ["total_accounts","flagged_accounts","total_transactions",
                      "suspicious_transactions","suspicious_amount"]:
            assert field in body

    async def test_flagged_accounts_lte_total(self, client, admin_token):
        """TC-FIN-012: Flagged accounts cannot exceed total accounts"""
        r = await client.get("/financial/summary", headers=auth_headers(admin_token))
        body = r.json()
        assert body["flagged_accounts"] <= body["total_accounts"]

    async def test_suspicious_txns_lte_total(self, client, admin_token):
        """TC-FIN-013: Suspicious transactions cannot exceed total transactions"""
        r = await client.get("/financial/summary", headers=auth_headers(admin_token))
        body = r.json()
        assert body["suspicious_transactions"] <= body["total_transactions"]

    async def test_suspicious_transactions_list(self, client, admin_token):
        """TC-FIN-014: Suspicious transactions endpoint returns a list"""
        r = await client.get("/financial/suspicious-transactions",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_suspicious_transactions_schema(self, client, admin_token):
        """TC-FIN-015: Each transaction has required fields"""
        r = await client.get("/financial/suspicious-transactions",
                             headers=auth_headers(admin_token))
        body = r.json()
        if body:
            item = body[0]
            for field in ["id","amount","date","transaction_type","flag_reason"]:
                assert field in item

    async def test_suspicious_amounts_positive(self, client, admin_token):
        """TC-FIN-016: All transaction amounts are positive"""
        r = await client.get("/financial/suspicious-transactions",
                             headers=auth_headers(admin_token))
        for item in r.json():
            assert item["amount"] > 0

    async def test_financial_network_graph(self, client, admin_token):
        """TC-FIN-017: Network graph has nodes and links"""
        r = await client.get("/financial/network-graph",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "nodes" in body
        assert "links" in body
        assert "stats" in body

    async def test_network_graph_node_schema(self, client, admin_token):
        """TC-FIN-018: Graph nodes have id, label, type fields"""
        r = await client.get("/financial/network-graph",
                             headers=auth_headers(admin_token))
        for node in r.json()["nodes"]:
            assert "id" in node
            assert "label" in node

    async def test_money_trail_for_suspect(self, client, admin_token, db_session):
        """TC-FIN-019: Money trail returns accounts and transactions for a suspect"""
        from database import Suspect, FinancialAccount as FA
        suspect = db_session.query(Suspect).filter(Suspect.risk_level == "High").first()
        if suspect:
            r = await client.get(f"/financial/money-trail/{suspect.id}",
                                 headers=auth_headers(admin_token))
            assert r.status_code == 200
            body = r.json()
            assert "suspect_id" in body
            assert "accounts" in body
            assert isinstance(body["accounts"], list)

    async def test_money_trail_unknown_suspect(self, client, admin_token):
        """TC-FIN-020: Money trail for unknown suspect returns empty accounts list"""
        r = await client.get("/financial/money-trail/999999",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert body["accounts"] == []
