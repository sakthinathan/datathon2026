# 🚔 SCRB CrimeIntel — Karnataka Crime Intelligence Platform

> An Intelligent Conversational AI and Crime Analytics Platform for the Karnataka State Crime Records Bureau (KSP/SCRB) Datathon. Fully customized with Karnataka State Police (KSP) official UI aesthetics.

---

## 📋 Project Overview

SCRB CrimeIntel is a modern digital intelligence portal enabling investigators, analysts, SPs, and policymakers to interact with the state crime database using **natural language queries**, advanced D3 networking graph visualizations, ML forecasts, and sociological correlation metrics.

The platform now features **Secure Role-Based Access Control (RBAC) Governance**, with dynamic navigation menus, route redirection guards, backend API protection, and an administrative account roster.

### Core Modules

| Module | Description |
|---|---|
| 🤖 AI Investigator | Natural language chat (EN + Kannada) with XAI SQL reasoning path visualization. |
| 🔎 Case Intelligence | FIR search, AI-generated case summaries, and automated lead recommendations. |
| 🕸️ Criminal Network | D3 force-directed gang visualization, centrality rankings, and organized crime clusters. |
| 💸 Financial Crimes | Suspicious transaction tables, money trail tracking, and account threat tags. |
| 🧬 Sociological Insights | Caste, unemployment, age, and economic crime pattern correlation analysis. |
| 🔮 Predictions (ML) | Early warning feed featuring Ridge, Gradient Boosting, and IsolationForest forecasting. |
| 🕵️ Offender Profiling | Suspect dossiers, repeat offender tracking, and Modus Operandi similarity matching. |
| 📊 Analytics | Tactical statistics, district-comparison charts, and Taluk solver matrices. |
| 👥 User Management | Account creation, jurisdiction allocation, and status toggle panel (Admin only). |
| 📋 Audit Trail | Log entries tracing every AI query, execution IP, and SQL command (Admin only). |

---

## 🔑 Demo Access Credentials (5 User Roles)

Login credentials representing each user persona seeded in the database:

| User Persona | Username | Password | Assigned District | Navigation & Permissions |
|---|---|---|---|---|
| **Super Admin** | `admin` | `admin123` | `All` (State-wide) | Full read/write access + User Management + Audit Trail |
| **District SP** | `sp_bengaluru` | `password123` | `Bengaluru Urban` | Overview charts/tables locked to Bengaluru Urban, Taluk performances |
| **Case Investigator** | `investigator1` | `password123` | `Mysuru` | Active cases timeline, surveillance watchlist, File FIR form, status controls |
| **Crime Analyst** | `analyst1` | `password123` | `All` (State-wide) | Predictions summary, demographics, organized communities, model details |
| **Read-Only Viewer** | `readonly1` | `password123` | `Bengaluru Urban` | State stats, bulletins feed, print brief reports. *All sensitive pages restricted* |

---

## 🔒 Access Control Governance

### 1. Dynamic Navigation Filtering
Sidebar items dynamically filter depending on the logged-in user's role. Restricted links are automatically omitted from rendering.

### 2. Client-Side Route Guards
If a user tries to bypass the UI and manually enter a restricted URL (e.g. an investigator accessing `/dashboard/audit`), a client-side route guard intercepts the mount phase in `layout.tsx` and immediately redirects the page back to `/dashboard`.

### 3. Backend Endpoint Role Gating
FastAPI routers enforce role requirements using jwt validation. For example, any non-admin requesting `/auth/users` or `/audit/logs` is rejected with `403 Forbidden`. The `/financial` intelligence APIs reject `readonly` sessions.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Recharts, Leaflet, Vanilla CSS |
| **Backend** | FastAPI (Python 3.13), SQLAlchemy, SQLite |
| **AI Engine** | Google Gemini 2.5 Flash |
| **Auth** | JWT (python-jose + bcrypt) |

---

## ⚡ Quick Start (Local Setup)

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

---

### 1. Clone the Repository

```bash
git clone https://github.com/sakthinathan/datathon2026.git
cd datathon2026
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

The SQLite database `crime.db` is **automatically seeded** on the first run with user profiles, police stations, crime records, suspect connections, predictions, and transaction logs.

Backend API docs: http://localhost:8000/docs

---

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend UI: http://localhost:3000

---

## 🔑 Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```env
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_jwt_secret_key_here
```

Get a free Gemini API key at: https://aistudio.google.com/app/apikey

> **Note:** The app functions without a Gemini API key by falling back to smart regex-based SQL queries. The key is only required for full natural language conversational answers.

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
datathon2026/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── database.py              # SQLAlchemy schemas + DB setup
│   ├── requirements.txt         # Python dependencies
│   ├── routers/                 # API route handlers (11 routers)
│   │   ├── auth.py              # Login + User administration
│   │   ├── audit.py             # Query auditing
│   │   ├── analytics.py         # Dynamic stats & district comparison
│   │   └── investigator.py      # Case summaries, timelines, FIR submissions
│   ├── services/
│   │   └── llm_service.py       # Gemini AI service + Kannada translation
│   └── data/
│       └── seed_data.py         # Database seeder logic
│
├── frontend/
│   ├── app/dashboard/           # Dashboard module folders
│   │   ├── users/               # Super Admin User roster
│   │   ├── page.tsx             # 5 custom dynamic sub-dashboard layouts
│   │   └── layout.tsx           # Sidebar navigation filter + route guards
│   └── lib/api.ts               # Fetch client functions
│
└── tests/
    ├── backend/                 # Pytest API suites
    └── e2e/                     # Playwright browser integration tests
```

---

## 👥 Team Workflow

1. Each developer runs the backend and frontend **locally**.
2. The database is seeded locally—no network resource database credentials needed.
3. Obtain personal free Gemini API keys via [Google AI Studio](https://aistudio.google.com/app/apikey).
4. Never commit `.env` keys or `.db` SQLite binaries to Git (enforced in `.gitignore`).
