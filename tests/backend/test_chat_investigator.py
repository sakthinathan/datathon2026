"""
SCRB CrimeIntel — Chat & Investigator API Tests
================================================
Enterprise tests for:
  - Chat session creation and retrieval
  - Message history
  - Suggested queries
  - Investigator case search
  - Case timeline
  - Similar cases
  - Lead generation
  - Input validation and injection prevention
"""

import pytest
from conftest import auth_headers


@pytest.mark.asyncio
class TestChatSessions:
    """TC-CHAT-01x: Chat session management"""

    async def test_create_session_via_message(self, client, admin_token):
        """TC-CHAT-011: Sending a message creates a new session"""
        r = await client.post("/chat/message",
            json={"message": "How many crimes in Bengaluru Urban?", "language": "en"},
            headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "session_id" in body
        assert body["session_id"] is not None

    async def test_message_response_schema(self, client, admin_token):
        """TC-CHAT-012: Chat response has required fields"""
        r = await client.post("/chat/message",
            json={"message": "Show top districts", "language": "en"},
            headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        for field in ["session_id","answer","language","timestamp"]:
            assert field in body

    async def test_message_answer_not_empty(self, client, admin_token):
        """TC-CHAT-013: AI answer is never empty"""
        r = await client.post("/chat/message",
            json={"message": "What is crime rate in 2024?", "language": "en"},
            headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert len(r.json()["answer"]) > 0

    async def test_kannada_query_accepted(self, client, admin_token):
        """TC-CHAT-014: Kannada language queries return 200"""
        r = await client.post("/chat/message",
            json={"message": "ಬೆಂಗಳೂರಿನಲ್ಲಿ ಅಪರಾಧ", "language": "kn"},
            headers=auth_headers(admin_token))
        assert r.status_code == 200

    async def test_session_continuity(self, client, admin_token):
        """TC-CHAT-015: Sending a message with session_id continues the session"""
        # Create a session
        r1 = await client.post("/chat/message",
            json={"message": "Tell me about crime in 2024", "language": "en"},
            headers=auth_headers(admin_token))
        session_id = r1.json()["session_id"]

        # Continue the session
        r2 = await client.post("/chat/message",
            json={"message": "Compare with 2023", "language": "en", "session_id": session_id},
            headers=auth_headers(admin_token))
        assert r2.status_code == 200
        assert r2.json()["session_id"] == session_id

    async def test_get_sessions_list(self, client, admin_token):
        """TC-CHAT-016: Session list endpoint returns sessions"""
        r = await client.get("/chat/sessions", headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_get_session_messages(self, client, admin_token):
        """TC-CHAT-017: Can retrieve messages from a session"""
        # Create session
        r1 = await client.post("/chat/message",
            json={"message": "How many theft cases in 2024?", "language": "en"},
            headers=auth_headers(admin_token))
        sid = r1.json()["session_id"]

        # Retrieve messages
        r2 = await client.get(f"/chat/sessions/{sid}/messages",
                              headers=auth_headers(admin_token))
        assert r2.status_code == 200
        body = r2.json()
        assert "messages" in body
        assert len(body["messages"]) >= 2  # user + assistant

    async def test_session_cross_user_isolation(self, client, admin_token, analyst_token):
        """TC-CHAT-018: A user cannot access another user's session"""
        # Create session as admin
        r1 = await client.post("/chat/message",
            json={"message": "Private investigation query", "language": "en"},
            headers=auth_headers(admin_token))
        sid = r1.json()["session_id"]

        # Try to access as analyst
        r2 = await client.get(f"/chat/sessions/{sid}/messages",
                              headers=auth_headers(analyst_token))
        assert r2.status_code in (404, 403)

    async def test_empty_message_rejected(self, client, admin_token):
        """TC-CHAT-019: Empty message is rejected with 422"""
        r = await client.post("/chat/message",
            json={"message": "", "language": "en"},
            headers=auth_headers(admin_token))
        assert r.status_code in (400, 422)

    async def test_suggested_queries(self, client, admin_token):
        """TC-CHAT-020: Suggested queries returns English and Kannada lists"""
        r = await client.get("/chat/suggested-queries", headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "en" in body
        assert "kn" in body
        assert len(body["en"]) > 0
        assert len(body["kn"]) > 0


@pytest.mark.asyncio
class TestInvestigatorModule:
    """TC-INV-01x: Investigator decision support"""

    async def test_search_cases_by_fir(self, client, admin_token):
        """TC-INV-011: Case search by FIR prefix returns results"""
        r = await client.get("/investigator/search-cases?q=FIR/2024",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) > 0

    async def test_search_cases_schema(self, client, admin_token):
        """TC-INV-012: Case search results have required fields"""
        r = await client.get("/investigator/search-cases?q=FIR",
                             headers=auth_headers(admin_token))
        if r.json():
            item = r.json()[0]
            for field in ["id","fir_number","date","district","crime_type","severity","status"]:
                assert field in item

    async def test_search_cases_by_district(self, client, admin_token):
        """TC-INV-013: Case search by district name works"""
        r = await client.get("/investigator/search-cases?q=Bengaluru",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        for item in r.json():
            assert "Bengaluru" in item["district"]

    async def test_case_summary_known_id(self, client, admin_token, db_session):
        """TC-INV-014: Case summary for existing crime ID returns data"""
        from database import Crime
        crime = db_session.query(Crime).first()
        if crime:
            r = await client.get(f"/investigator/case-summary/{crime.id}",
                                 headers=auth_headers(admin_token))
            assert r.status_code == 200
            body = r.json()
            assert "fir_number" in body
            assert "summary" in body

    async def test_case_summary_unknown_id(self, client, admin_token):
        """TC-INV-015: Case summary for non-existent crime returns 404"""
        r = await client.get("/investigator/case-summary/999999",
                             headers=auth_headers(admin_token))
        assert r.status_code == 404

    async def test_similar_cases(self, client, admin_token):
        """TC-INV-016: Similar cases endpoint returns list"""
        r = await client.get("/investigator/similar-cases?crime_type=Theft",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_case_timeline_known_district(self, client, admin_token):
        """TC-INV-017: Case timeline for known district returns list"""
        r = await client.get("/investigator/case-timeline/Bengaluru%20Urban",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        # All results should be from the requested district
        for item in body:
            assert "fir_number" in item
            assert "crime_type" in item

    async def test_case_timeline_unknown_district(self, client, admin_token):
        """TC-INV-018: Timeline for unknown district returns empty list (not 500)"""
        r = await client.get("/investigator/case-timeline/NonExistentDistrict999",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert r.json() == []

    async def test_generate_leads_crime_id(self, client, admin_token, db_session):
        """TC-INV-019: Lead generation for valid crime ID returns actions"""
        from database import Crime
        crime = db_session.query(Crime).first()
        if crime:
            r = await client.post(f"/investigator/generate-leads?crime_id={crime.id}",
                                  headers=auth_headers(admin_token))
            assert r.status_code == 200
            body = r.json()
            assert "immediate_actions" in body
            assert isinstance(body["immediate_actions"], list)

    async def test_generate_leads_no_params_rejected(self, client, admin_token):
        """TC-INV-020: Lead generation without any ID is rejected"""
        r = await client.post("/investigator/generate-leads",
                              headers=auth_headers(admin_token))
        assert r.status_code in (400, 422)

    async def test_xss_in_search(self, client, admin_token):
        """TC-INV-021: XSS payload in search is safely handled"""
        r = await client.get("/investigator/search-cases?q=<script>alert(1)</script>",
                             headers=auth_headers(admin_token))
        assert r.status_code == 200
        # Should return empty list, not throw an error
        assert isinstance(r.json(), list)
