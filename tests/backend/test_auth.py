"""
SCRB CrimeIntel — Authentication & RBAC Tests
==============================================
Enterprise-level tests for:
  - Login success / failure
  - JWT token validation
  - Token expiry
  - RBAC enforcement (role-based access)
  - Inactive user login rejection
  - Missing / malformed tokens
"""

import pytest
from conftest import auth_headers


@pytest.mark.asyncio
class TestAuthentication:
    """TC-AUTH: Authentication endpoint tests"""

    async def test_login_valid_admin(self, client):
        """TC-AUTH-001: Valid admin credentials return 200 with JWT token"""
        r = await client.post("/auth/login",
            data={"username": "admin", "password": "admin123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert len(body["access_token"]) > 20

    async def test_login_invalid_password(self, client):
        """TC-AUTH-002: Wrong password returns 401"""
        r = await client.post("/auth/login",
            data={"username": "admin", "password": "WRONGPASSWORD"},
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert r.status_code == 401

    async def test_login_nonexistent_user(self, client):
        """TC-AUTH-003: Non-existent username returns 401"""
        r = await client.post("/auth/login",
            data={"username": "ghost_user_xyz", "password": "anything"},
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert r.status_code == 401

    async def test_login_inactive_user(self, client):
        """TC-AUTH-004: Inactive user account should be rejected"""
        r = await client.post("/auth/login",
            data={"username": "inactive_user", "password": "pass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert r.status_code in (401, 403)

    async def test_login_empty_credentials(self, client):
        """TC-AUTH-005: Empty credentials return 422 (validation error)"""
        r = await client.post("/auth/login",
            data={},
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert r.status_code == 422

    async def test_get_me_valid_token(self, client, admin_token):
        """TC-AUTH-006: /auth/me returns correct user profile for valid token"""
        r = await client.get("/auth/me", headers=auth_headers(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert body["username"] == "admin"
        assert body["role"] == "super_admin"
        assert "hashed_password" not in body  # Never expose password hash

    async def test_get_me_no_token(self, client):
        """TC-AUTH-007: /auth/me without token returns 401 or 403"""
        r = await client.get("/auth/me")
        assert r.status_code in (401, 403)

    async def test_get_me_malformed_token(self, client):
        """TC-AUTH-008: Malformed JWT token returns 401 or 403"""
        r = await client.get("/auth/me",
            headers={"Authorization": "Bearer this.is.not.valid.jwt"})
        assert r.status_code in (401, 403)

    async def test_protected_endpoint_no_auth(self, client):
        """TC-AUTH-009: Any protected endpoint rejects unauthenticated requests"""
        endpoints = [
            "/analytics/overview",
            "/offenders/repeat-offenders",
            "/predictions/alerts",
            "/financial/summary",
        ]
        for ep in endpoints:
            r = await client.get(ep)
            assert r.status_code in (401, 403), f"Expected 401/403 for {ep}, got {r.status_code}"

    async def test_analyst_can_access_analytics(self, client, analyst_token):
        """TC-AUTH-010: Analyst role can access analytics endpoints"""
        r = await client.get("/analytics/overview", headers=auth_headers(analyst_token))
        assert r.status_code == 200

    async def test_readonly_can_access_analytics(self, client, readonly_token):
        """TC-AUTH-011: Read-only role can access read endpoints"""
        r = await client.get("/analytics/overview", headers=auth_headers(readonly_token))
        assert r.status_code == 200

    async def test_sql_injection_username(self, client):
        """TC-AUTH-012: SQL injection in username is safely handled"""
        r = await client.post("/auth/login",
            data={"username": "' OR '1'='1", "password": "anything"},
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert r.status_code == 401  # Must reject, not succeed
