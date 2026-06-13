from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./crime.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=10000")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Crime(Base):
    __tablename__ = "crimes"
    id = Column(Integer, primary_key=True, index=True)
    fir_number = Column(String, unique=True, index=True)
    date = Column(String, index=True)
    time = Column(String)
    year = Column(Integer, index=True)
    month = Column(Integer, index=True)
    district = Column(String, index=True)
    taluk = Column(String)
    police_station = Column(String, index=True)
    crime_type = Column(String, index=True)
    ipc_section = Column(String)
    severity = Column(String)   # Low, Medium, High, Critical
    status = Column(String)     # Filed, Under Investigation, Chargesheeted, Closed
    latitude = Column(Float)
    longitude = Column(Float)
    description = Column(Text)
    victim_count = Column(Integer, default=1)
    accused_count = Column(Integer, default=1)
    property_value = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Suspect(Base):
    __tablename__ = "suspects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    alias = Column(String)
    age = Column(Integer)
    gender = Column(String)
    district = Column(String)
    occupation = Column(String)
    crime_history = Column(Text)   # comma-separated crime IDs
    connections = Column(Text)     # comma-separated suspect IDs
    risk_level = Column(String)    # Low, Medium, High
    photo_url = Column(String)


class Victim(Base):
    __tablename__ = "victims"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    age = Column(Integer)
    gender = Column(String)
    district = Column(String)
    crime_ids = Column(Text)


class PoliceStation(Base):
    __tablename__ = "police_stations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    district = Column(String, index=True)
    taluk = Column(String)
    officer_count = Column(Integer)
    cases_filed = Column(Integer, default=0)
    cases_solved = Column(Integer, default=0)
    latitude = Column(Float)
    longitude = Column(Float)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(String)   # super_admin, district_sp, investigator, analyst, readonly
    district = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, default="New Investigation")
    created_at = Column(DateTime, default=datetime.utcnow)
    messages = relationship("ChatMessage", back_populates="session")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    role = Column(String)    # user, assistant
    content = Column(Text)
    sql_query = Column(Text)
    language = Column(String, default="en")
    timestamp = Column(DateTime, default=datetime.utcnow)
    session = relationship("ChatSession", back_populates="messages")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    username = Column(String)
    action = Column(String)
    query = Column(Text)
    sql_generated = Column(Text)
    result_count = Column(Integer, default=0)
    ip_address = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)


class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    district = Column(String)
    crime_type = Column(String)
    predicted_month = Column(String)
    predicted_count = Column(Integer)
    confidence = Column(Float)
    severity = Column(String)   # Critical, Warning, Normal
    trend = Column(String)      # Rising, Stable, Falling
    created_at = Column(DateTime, default=datetime.utcnow)


class FinancialAccount(Base):
    __tablename__ = "financial_accounts"
    id             = Column(Integer, primary_key=True, index=True)
    suspect_id     = Column(Integer, ForeignKey("suspects.id"), nullable=True)
    account_number = Column(String, unique=True, index=True)
    bank_name      = Column(String)
    account_type   = Column(String)   # Savings, Current, Crypto, Hawala
    flagged        = Column(Boolean, default=False)
    flag_reason    = Column(String, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)


class FinancialTransaction(Base):
    __tablename__ = "financial_transactions"
    id               = Column(Integer, primary_key=True, index=True)
    from_account     = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    to_account       = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    amount           = Column(Float)
    date             = Column(String)
    crime_id         = Column(Integer, ForeignKey("crimes.id"), nullable=True)
    suspicious       = Column(Boolean, default=False)
    flag_reason      = Column(String, nullable=True)
    transaction_type = Column(String)   # Transfer, Withdrawal, Crypto, Cash
    created_at       = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
