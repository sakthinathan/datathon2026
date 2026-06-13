from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os, sys
from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

from database import create_tables
from routers import auth, analytics, chat, network, predictions, audit, offenders, sociology, investigator, financial

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed data
    create_tables()
    try:
        from data.seed_data import run_seed
        run_seed()
    except Exception as e:
        print(f"Seed warning: {e}")

    # Startup ML models check and train if not present
    try:
        from database import SessionLocal
        from services.ml_service import MODELS_DIR, train_and_save_all_models
        pkl_files = []
        if os.path.exists(MODELS_DIR):
            pkl_files = [f for f in os.listdir(MODELS_DIR) if f.endswith(".pkl")]
        if not pkl_files:
            print("🚀 Startup: No serialized ML models found. Starting initial model training...")
            db = SessionLocal()
            try:
                train_and_save_all_models(db)
            finally:
                db.close()
        else:
            print(f"✨ Startup: Found {len(pkl_files)} serialized ML models. Skipping initial training.")
    except Exception as e:
        print(f"Startup ML check warning: {e}")
    yield

app = FastAPI(
    title="SCRB Karnataka Crime Intelligence API",
    description="AI-powered crime analytics platform for the State Crime Records Bureau of Karnataka",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(analytics.router)
app.include_router(chat.router)
app.include_router(network.router)
app.include_router(predictions.router)
app.include_router(audit.router)
app.include_router(offenders.router)
app.include_router(sociology.router)
app.include_router(investigator.router)
app.include_router(financial.router)

@app.get("/")
async def root():
    return {
        "name": "SCRB Karnataka Crime Intelligence API",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "SCRB API"}
