# 🚔 SCRB CrimeIntel — Karnataka Crime Intelligence Platform

> An Intelligent Conversational AI and Crime Analytics Platform for the Karnataka State Crime Records Bureau (KSP/SCRB) Datathon.

---

## 📋 Project Overview

SCRB CrimeIntel enables investigators, analysts, and policymakers to interact with the state crime database using **natural language queries**, providing advanced analytical capabilities grounded in criminology and sociological insights.

### Key Modules

| Module | Description |
|---|---|
| 🤖 AI Investigator | Natural language chat (EN + Kannada) with XAI reasoning panel |
| 🔎 Case Intelligence | FIR search, AI case summaries, lead generation |
| 🕸️ Criminal Network | D3 force-directed graph of suspect connections |
| 💸 Financial Crimes | Suspicious transaction tracking and money trail network |
| 🧬 Sociological Insights | Demographic and economic crime pattern analysis |
| 🔮 Predictive Alerts | Early warning feed with district-level forecasts |
| 🕵️ Offender Profiling | High-risk suspect risk scoring and behavioral tagging |
| 📊 Analytics | Full crime analytics dashboard with 8 chart types |
| 📋 Audit Trail | Tamper-evident audit log of all AI queries |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Recharts, Leaflet |
| Backend | FastAPI (Python 3.13), SQLAlchemy, SQLite |
| AI | Google Gemini 2.5 Flash |
| Auth | JWT (python-jose + bcrypt) |

---

## ⚡ Quick Start (Local Setup)

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

---

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/scrb-crimeintel.git
cd scrb-crimeintel
```

---

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate        # Mac/Linux
# .venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

**Start the backend:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The database is **auto-seeded** on first run with ~3.3 lakh crime records across 31 Karnataka districts.

Backend API docs: http://localhost:8000/docs

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend: http://localhost:3000

---

### 4. Login

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |

---

## 🔑 Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_jwt_secret_key_here
```

Get a free Gemini API key at: https://aistudio.google.com/app/apikey

> **Note:** The app works without a Gemini API key — it falls back to smart keyword-based SQL queries. You only need the key for full AI-powered natural language responses.

---

## 🧪 Running Tests

### Backend API Tests (124 tests)
```bash
cd tests/backend
../../backend/.venv/bin/python -m pytest -v
```

### E2E Browser Tests (21 tests)
```bash
cd tests/e2e
../../backend/.venv/bin/python -m pytest test_e2e_playwright.py -v --browser chromium
```

---

## 📁 Project Structure

```
scrb-crimeintel/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── database.py              # SQLAlchemy models + DB setup
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment variable template
│   ├── routers/                 # API route handlers (10 modules)
│   ├── services/
│   │   └── llm_service.py       # Gemini AI + smart SQL fallback
│   └── data/
│       └── seed_data.py         # Auto-seeds DB on first run
│
├── frontend/
│   ├── app/dashboard/           # All 10 dashboard module pages
│   ├── app/login/               # Login page
│   └── lib/api.ts               # API helper functions
│
└── tests/
    ├── backend/                 # 124 pytest API tests
    └── e2e/                     # 21 Playwright browser tests
```

---

## 👥 Team Workflow

1. Each member runs the backend and frontend **locally**
2. The SQLite DB is seeded automatically — no shared DB needed
3. Each member gets their own free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Never commit `.env` files or `*.db` files (covered by `.gitignore`)
