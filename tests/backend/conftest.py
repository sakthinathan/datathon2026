"""
SCRB CrimeIntel — Enterprise Test Suite
========================================
Shared pytest fixtures: test DB, test client, auth tokens.
All tests use an isolated in-memory SQLite database.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ── patch env so LLM calls are skipped in tests ──────────────────────────────
os.environ.setdefault("GEMINI_API_KEY", "TEST_DISABLED")

from database import Base, get_db, User, Crime, Suspect, Prediction, FinancialAccount, FinancialTransaction
from main import app
import bcrypt

# ── In-memory test DB ─────────────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite:///./test_scrb.db"

engine = pytest.fixture(scope="session")(lambda: create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
))


@pytest.fixture(scope="session")
def db_engine():
    eng = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()
    try:
        os.remove("./test_scrb.db")
    except Exception:
        pass


@pytest.fixture(scope="session")
def db_session(db_engine):
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="session", autouse=True)
def seed_test_data(db_session):
    """Seed minimal but representative test data."""
    # Users
    def hp(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

    users = [
        User(username="admin", hashed_password=hp("admin123"), full_name="Admin User",
             role="super_admin", district="All", is_active=True),
        User(username="analyst1", hashed_password=hp("pass123"), full_name="Data Analyst",
             role="analyst", district="All", is_active=True),
        User(username="readonly1", hashed_password=hp("pass123"), full_name="Read Only",
             role="readonly", district="Bengaluru Urban", is_active=True),
        User(username="inactive_user", hashed_password=hp("pass123"), full_name="Inactive",
             role="analyst", district="All", is_active=False),
    ]
    db_session.bulk_save_objects(users)
    db_session.commit()

    # Crimes
    crimes = []
    for i in range(1, 51):
        crimes.append(Crime(
            fir_number=f"FIR/2024/{10000+i}",
            date=f"2024-0{(i%9)+1}-{(i%28)+1:02d}",
            time=f"{i%24:02d}:00",
            year=2024, month=(i % 12) + 1,
            district="Bengaluru Urban" if i % 2 == 0 else "Mysuru",
            taluk="Bengaluru North" if i % 2 == 0 else "Mysuru",
            police_station=f"Test PS-{i%5+1}",
            crime_type=["Murder","Theft","Robbery","Cybercrime","Assault"][i % 5],
            ipc_section=["302 IPC","379 IPC","392 IPC","66C IT Act","324 IPC"][i % 5],
            severity=["Critical","High","Medium","Low"][i % 4],
            status=["Filed","Under Investigation","Chargesheeted","Closed"][i % 4],
            latitude=12.97 + (i * 0.01), longitude=77.59 + (i * 0.01),
            description=f"Test crime incident {i} description for testing purposes",
            victim_count=i % 3 + 1, accused_count=i % 2 + 1,
            property_value=float(i * 10000),
        ))
    db_session.bulk_save_objects(crimes)
    db_session.commit()

    # Suspects
    suspects = []
    for i in range(1, 21):
        suspects.append(Suspect(
            name=f"Test Suspect {i}", alias=f"@alias{i}",
            age=20 + i, gender="Male" if i % 2 else "Female",
            district="Bengaluru Urban" if i % 2 == 0 else "Mysuru",
            occupation=["Unemployed","Laborer","Farmer","Driver"][i % 4],
            crime_history=",".join(str(j) for j in range(1, i % 5 + 2)),
            connections=",".join(str(j) for j in range(1, i % 4 + 2)),
            risk_level=["High","Medium","Low"][i % 3],
        ))
    db_session.bulk_save_objects(suspects)
    db_session.commit()

    # Predictions
    preds = []
    for i, district in enumerate(["Bengaluru Urban","Mysuru","Hubballi-Dharwad","Mangaluru","Belagavi"]):
        for ct, sev, trend, conf in [
            ("Murder","Critical","Rising",0.91),
            ("Theft","Warning","Rising",0.82),
            ("Cybercrime","Normal","Stable",0.70),
        ]:
            preds.append(Prediction(
                district=district, crime_type=ct,
                predicted_month="2025-01",
                predicted_count=100 + i * 10,
                confidence=conf, severity=sev, trend=trend
            ))
    db_session.bulk_save_objects(preds)
    db_session.commit()

    # Financial data
    db_session.flush()
    all_suspects = db_session.query(Suspect).filter(Suspect.risk_level == "High").all()
    accounts = []
    for s in all_suspects[:5]:
        accounts.append(FinancialAccount(
            suspect_id=s.id, account_number=f"ACC{90000000+s.id}",
            bank_name="SBI", account_type="Savings",
            flagged=True, flag_reason="Multiple suspicious withdrawals"
        ))
    db_session.bulk_save_objects(accounts)
    db_session.commit()

    all_accounts = db_session.query(FinancialAccount).all()
    if len(all_accounts) >= 2:
        txns = [
            FinancialTransaction(
                from_account=all_accounts[0].id,
                to_account=all_accounts[1].id,
                amount=500000.0, date="2024-01-15",
                suspicious=True, flag_reason="Round amount transfer",
                transaction_type="Transfer"
            ),
            FinancialTransaction(
                from_account=all_accounts[1].id if len(all_accounts) > 1 else all_accounts[0].id,
                to_account=all_accounts[0].id,
                amount=12000.0, date="2024-02-20",
                suspicious=False, transaction_type="Withdrawal"
            ),
        ]
        db_session.bulk_save_objects(txns)
        db_session.commit()

    yield  # tests run here


@pytest.fixture(scope="session")
def override_db(db_session):
    def _override():
        yield db_session
    return _override


@pytest.fixture(scope="session")
def test_app(override_db):
    app.dependency_overrides[get_db] = override_db
    yield app
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
async def client(test_app):
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://testserver"
    ) as c:
        yield c


@pytest.fixture(scope="session")
async def admin_token(client):
    r = await client.post("/auth/login",
        data={"username": "admin", "password": "admin123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="session")
async def analyst_token(client):
    r = await client.post("/auth/login",
        data={"username": "analyst1", "password": "pass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="session")
async def readonly_token(client):
    r = await client.post("/auth/login",
        data={"username": "readonly1", "password": "pass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 200
    return r.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
