import os, re, json
import httpx
from database import SessionLocal, Crime, Suspect, PoliceStation, AuditLog
from sqlalchemy import text
from datetime import datetime

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

_httpx_client = None

def get_httpx_client() -> httpx.AsyncClient:
    global _httpx_client
    if _httpx_client is None or _httpx_client.is_closed:
        _httpx_client = httpx.AsyncClient(timeout=30.0)
    return _httpx_client

# Base system prompts for RAG Agent
SYSTEM_PROMPT_BASE = """You are SCRB CrimeBot, an expert AI assistant for the State Crime Records Bureau of Karnataka, India.
You help police investigators, analysts, and officers query a crime database using natural language.
"""

SQL_GENERATION_PROMPT = """You are SCRB CrimeBot, a translation assistant that converts natural language queries into valid SQLite queries.
DATABASE SCHEMA:
- crimes(id, fir_number, date, time, year, month, district, taluk, police_station, crime_type, ipc_section, severity, status, latitude, longitude, description, victim_count, accused_count, property_value)
- suspects(id, name, alias, age, gender, district, occupation, crime_history, connections, risk_level)
- police_stations(id, name, district, taluk, officer_count, cases_filed, cases_solved)
- predictions(id, district, crime_type, predicted_month, predicted_count, confidence, severity, trend)

IMPORTANT SQL RULES:
1. Generate ONLY a single SQLite-compatible SELECT statement to answer the question.
2. For FIR searches, use: fir_number = 'FIR/YYYY/NNNNN' or fir_number LIKE '%search%'
3. To find crimes/offenses committed by a suspect, join crimes and suspects. Since suspects.crime_history is a comma-separated string of crime IDs, you can join using:
   SELECT c.* FROM crimes c JOIN suspects s ON (',' || s.crime_history || ',') LIKE ('%,' || c.id || ',%') WHERE s.name LIKE '%suspect_name%'
4. Limit SQL results to 20 rows maximum.
5. If the user question does not require a database query (e.g. greetings, generic questions, help requests), output an empty string for the sql query.
6. Return your response in JSON format with ONLY the "sql" field: {"sql": "SELECT ..."} or {"sql": ""} if no DB lookup is needed. Do not wrap in markdown or code fences.
"""

ANSWER_SYNTHESIS_PROMPT = """You are SCRB CrimeBot, an expert AI assistant for the State Crime Records Bureau of Karnataka, India.
Your task is to synthesize a professional response to the user's question using the actual data retrieved from the database.

IMPORTANT SYNTHESIS RULES:
1. Base your answer strictly on the actual database results provided to you. If no data was found, state that clearly.
2. Translate and write the response in the specified language (English or Kannada).
3. Do NOT mention any SQL queries, columns, or database technicalities in your final answer.
4. Return your response in JSON format: {"answer": "...", "insights": ["...", "..."]}
5. "insights" should contain 2-3 brief observations or recommendations based on the data.
"""

LANG_INSTRUCTIONS = {
    "kn": "CRITICAL LANGUAGE RULE: The user has selected Kannada (ಕನ್ನಡ) mode. You MUST write the entire 'answer' field in Kannada script. The 'insights' list must also be in Kannada. Do NOT respond in English.",
    "en": "LANGUAGE RULE: Respond in clear professional English.",
}

LANG_INSTRUCTIONS = {
    "kn": "CRITICAL LANGUAGE RULE: The user has selected Kannada (ಕನ್ನಡ) mode. You MUST write the entire 'answer' field in Kannada script. The 'insights' list must also be in Kannada. Only the 'sql' field stays in English (SQL syntax). Do NOT respond in English.",
    "en": "LANGUAGE RULE: Respond in clear professional English.",
}

def build_system_prompt(language: str) -> str:
    return SYSTEM_PROMPT_BASE + "\n" + LANG_INSTRUCTIONS.get(language, LANG_INSTRUCTIONS["en"])

MOCK_PATTERNS = [
    {
        "type": "fir_lookup",
        "keywords": ["fir/", "fir number", "case number", "fir no"],
        "sql_template": "SELECT fir_number, date, time, district, taluk, police_station, crime_type, ipc_section, severity, status, description, victim_count, accused_count, property_value FROM crimes WHERE LOWER(fir_number) LIKE LOWER('%{query}%') LIMIT 5",
        "template": "📁 **FIR Lookup: {query}**\n\n{data}\n\n> Case details retrieved from SCRB database."
    },
    {
        "type": "top_districts",
        "keywords": ["top", "most", "highest", "district", "crime"],
        "sql": "SELECT district, COUNT(*) as total FROM crimes GROUP BY district ORDER BY total DESC LIMIT 10",
        "template": "📊 **Top Crime Districts in Karnataka**\n\n{data}\n\n> The data shows Bengaluru Urban consistently leads due to higher population density."
    },
    {
        "type": "yearly_trend",
        "keywords": ["trend", "year", "annual", "growth"],
        "sql": "SELECT year, COUNT(*) as total FROM crimes GROUP BY year ORDER BY year",
        "template": "📈 **Year-wise Crime Trend**\n\n{data}\n\n> Overall crime trends reveal seasonal patterns and enforcement effectiveness."
    },
    {
        "type": "murder",
        "keywords": ["murder", "homicide", "killed"],
        "sql": "SELECT district, COUNT(*) as murders FROM crimes WHERE crime_type='Murder' GROUP BY district ORDER BY murders DESC LIMIT 10",
        "template": "🔴 **Murder Cases by District**\n\n{data}\n\n> Critical severity crimes require immediate inter-district coordination."
    },
    {
        "type": "theft",
        "keywords": ["theft", "stolen", "robbery"],
        "sql": "SELECT district, COUNT(*) as cases FROM crimes WHERE crime_type IN ('Theft','Robbery','Burglary','Vehicle Theft') GROUP BY district ORDER BY cases DESC LIMIT 10",
        "template": "🔒 **Theft & Robbery by District**\n\n{data}\n\n> Property crimes spike during festive seasons — Oct-Dec shows highest rates."
    },
    {
        "type": "cyber",
        "keywords": ["cyber", "online", "internet", "fraud", "digital"],
        "sql": "SELECT district, COUNT(*) as cases FROM crimes WHERE crime_type IN ('Cybercrime','Fraud') GROUP BY district ORDER BY cases DESC LIMIT 10",
        "template": "💻 **Cybercrime & Fraud Analysis**\n\n{data}\n\n> Urban districts with higher internet penetration show significantly more cybercrime."
    },
    {
        "type": "drug",
        "keywords": ["drug", "narco", "ndps"],
        "sql": "SELECT district, COUNT(*) as cases FROM crimes WHERE crime_type='Drug Offense' GROUP BY district ORDER BY cases DESC LIMIT 10",
        "template": "💊 **Drug Offense Distribution**\n\n{data}\n\n> Border districts show higher drug activity due to cross-border trafficking routes."
    },
    {
        "type": "women_crimes",
        "keywords": ["women", "female", "gender", "pocso", "domestic"],
        "sql": "SELECT crime_type, COUNT(*) as cases FROM crimes WHERE crime_type IN ('POCSO','Domestic Violence','Rape') GROUP BY crime_type ORDER BY cases DESC",
        "template": "👩 **Crimes Against Women & Children**\n\n{data}\n\n> These cases require specialized investigation units and victim support services."
    },
    {
        "type": "bengaluru",
        "keywords": ["bengaluru", "bangalore", "bnglr"],
        "sql": "SELECT crime_type, COUNT(*) as cases FROM crimes WHERE district='Bengaluru Urban' GROUP BY crime_type ORDER BY cases DESC LIMIT 10",
        "template": "🏙️ **Bengaluru Urban Crime Profile**\n\n{data}\n\n> As Karnataka's capital, Bengaluru sees diverse crime patterns with cybercrime emerging rapidly."
    },
    {
        "type": "mysuru",
        "keywords": ["mysuru", "mysore"],
        "sql": "SELECT crime_type, COUNT(*) as cases FROM crimes WHERE district='Mysuru' GROUP BY crime_type ORDER BY cases DESC LIMIT 10",
        "template": "🏛️ **Mysuru Crime Profile**\n\n{data}\n\n> Mysuru's crime profile reflects its tourism activity and urban growth."
    },
    {
        "type": "police_station",
        "keywords": ["station", "police", "ps", "performance"],
        "sql": "SELECT name, district, cases_filed, cases_solved, ROUND(CAST(cases_solved AS FLOAT)/CAST(cases_filed AS FLOAT)*100,1) as solve_rate FROM police_stations ORDER BY solve_rate DESC LIMIT 10",
        "template": "🚓 **Top Performing Police Stations**\n\n{data}\n\n> Case resolution rate is a key metric for station-level resource allocation."
    },
    {
        "type": "predictions",
        "keywords": ["predict", "forecast", "alert", "warning", "future"],
        "sql": "SELECT district, crime_type, predicted_count, confidence, severity, trend FROM predictions WHERE severity IN ('Critical','Warning') ORDER BY predicted_count DESC LIMIT 10",
        "template": "🔮 **Predictive Crime Alerts**\n\n{data}\n\n> These districts require proactive deployment and preventive patrolling."
    },
    {
        "type": "suspects",
        "keywords": ["suspect", "accused", "criminal", "network"],
        "sql": "SELECT district, risk_level, COUNT(*) as count FROM suspects GROUP BY district, risk_level ORDER BY count DESC LIMIT 10",
        "template": "🕵️ **Suspect Risk Profile by District**\n\n{data}\n\n> High-risk suspects require active surveillance and coordination."
    },
    {
        "type": "year_2023",
        "keywords": ["2023", "last year"],
        "sql": "SELECT crime_type, COUNT(*) as total FROM crimes WHERE year=2023 GROUP BY crime_type ORDER BY total DESC LIMIT 10",
        "template": "📅 **Crime Analysis - Year 2023**\n\n{data}\n\n> 2023 data reflects post-pandemic socio-economic patterns in Karnataka."
    },
    {
        "type": "year_2024",
        "keywords": ["2024", "current year", "recent"],
        "sql": "SELECT crime_type, COUNT(*) as total FROM crimes WHERE year=2024 GROUP BY crime_type ORDER BY total DESC LIMIT 10",
        "template": "📅 **Crime Analysis - Year 2024**\n\n{data}\n\n> Recent crime data helps identify emerging patterns requiring immediate response."
    },
    {
        "type": "pending",
        "keywords": ["unsolved", "pending", "investigation", "open"],
        "sql": "SELECT district, COUNT(*) as pending FROM crimes WHERE status='Under Investigation' GROUP BY district ORDER BY pending DESC LIMIT 10",
        "template": "⏳ **Pending Investigation Cases**\n\n{data}\n\n> High pending cases indicate resource constraints and may need inter-district support."
    },
    {
        "type": "monthly",
        "keywords": ["month", "monthly", "season"],
        "sql": "SELECT month, COUNT(*) as total FROM crimes GROUP BY month ORDER BY month",
        "template": "📆 **Monthly Crime Pattern**\n\n{data}\n\n> Festive months (Oct-Dec) show elevated crime rates — enhanced patrolling is recommended."
    },
]

KANNADA_PATTERNS = [
    {"keywords": ["ಅಪರಾಧ", "ಜಿಲ್ಲೆ"],
     "sql": "SELECT district, COUNT(*) as total FROM crimes GROUP BY district ORDER BY total DESC LIMIT 10",
     "template": "📊 **ಕರ್ನಾಟಕದಲ್ಲಿ ಅತ್ಯಧಿಕ ಅಪರಾಧ ಜಿಲ್ಲೆಗಳು**\n\n{data}\n\n> ಜನಸಂಖ್ಯಾ ಸಾಂದ್ರತೆ ಹೆಚ್ಚಿರುವ ಜಿಲ್ಲೆಗಳಲ್ಲಿ ಅಪರಾಧ ಪ್ರಕರಣಗಳು ಹೆಚ್ಚಾಗಿ ಕಂಡುಬರುತ್ತವೆ."},
    {"keywords": ["ಕೊಲೆ", "ಹತ್ಯೆ"],
     "sql": "SELECT district, COUNT(*) as murders FROM crimes WHERE crime_type='Murder' GROUP BY district ORDER BY murders DESC LIMIT 10",
     "template": "🔴 **ಜಿಲ್ಲೆವಾರು ಕೊಲೆ ಪ್ರಕರಣಗಳು**\n\n{data}\n\n> ಅತ್ಯಂತ ಗಂಭೀರ ಪ್ರಕರಣಗಳಿಗೆ ತಕ್ಷಣದ ಗಮನ ಅಗತ್ಯ."},
    {"keywords": ["ಕಳ್ಳತನ", "ದರೋಡೆ"],
     "sql": "SELECT district, COUNT(*) as cases FROM crimes WHERE crime_type IN ('Theft','Robbery') GROUP BY district ORDER BY cases DESC LIMIT 10",
     "template": "🔒 **ಕಳ್ಳತನ ಮತ್ತು ದರೋಡೆ ಅಂಕಿಅಂಶಗಳು**\n\n{data}\n\n> ಹಬ್ಬಗಳ ಸಮಯದಲ್ಲಿ ಆಸ್ತಿ ಸಂಬಂಧಿ ಅಪರಾಧಗಳು ಹೆಚ್ಚಾಗುತ್ತವೆ."},
    {"keywords": ["ಬೆಂಗಳೂರು"],
     "sql": "SELECT crime_type, COUNT(*) as cases FROM crimes WHERE district='Bengaluru Urban' GROUP BY crime_type ORDER BY cases DESC LIMIT 10",
     "template": "🏙️ **ಬೆಂಗಳೂರು ನಗರದ ಅಪರಾಧ ಪ್ರೊಫೈಲ್**\n\n{data}\n\n> ಕರ್ನಾಟಕದ ರಾಜಧಾನಿಯಾಗಿ ಬೆಂಗಳೂರು ವಿವಿಧ ರೀತಿಯ ಅಪರಾಧಗಳನ್ನು ಅನುಭವಿಸುತ್ತಿದೆ."},
]


def is_kannada(text: str) -> bool:
    return any('\u0C80' <= c <= '\u0CFF' for c in text)


def format_sql_results(rows, columns) -> str:
    if not rows:
        return "_No records found_"
    lines = []
    for i, row in enumerate(rows[:15], 1):
        parts = [f"**{col}**: {val}" for col, val in zip(columns, row)]
        lines.append(f"{i}. " + " | ".join(parts))
    return "\n".join(lines)


def format_fir_detail(row, columns) -> str:
    """Rich single-FIR card format."""
    if not row:
        return "_No record found for that FIR number._"
    d = dict(zip(columns, row))
    lines = [
        f"📁 **FIR Number:** `{d.get('fir_number', 'N/A')}`",
        f"📅 **Date/Time:** {d.get('date', 'N/A')} {d.get('time', '')}",
        f"📍 **Location:** {d.get('district', 'N/A')} → {d.get('taluk', 'N/A')} → {d.get('police_station', 'N/A')}",
        f"⚖️ **Crime Type:** {d.get('crime_type', 'N/A')} (IPC: {d.get('ipc_section', 'N/A')})",
        f"🚨 **Severity:** {d.get('severity', 'N/A')} | **Status:** {d.get('status', 'N/A')}",
        f"👥 **Victims:** {d.get('victim_count', 'N/A')} | **Accused:** {d.get('accused_count', 'N/A')}",
    ]
    if d.get('property_value'):
        lines.append(f"💰 **Property Value:** ₹{float(d['property_value']):,.0f}")
    if d.get('description'):
        lines.append(f"📝 **Description:** {d.get('description', '')}")
    return "\n".join(lines)


def extract_fir_number(message: str) -> str | None:
    """Extract a FIR number pattern from the message."""
    # Match patterns like FIR/2024/10001 or FIR/2023/99999
    m = re.search(r'(fir[/\\-]\d{4}[/\\-]\d+)', message, re.IGNORECASE)
    if m:
        return m.group(1).upper().replace('\\', '/').replace('-', '/')
    # Match partial like just the number part if user typed "10001" after FIR context
    return None


def get_mock_response(user_message: str, db, ui_language: str = "en") -> dict:
    msg_lower = user_message.lower()
    # Language = explicit UI toggle OR Unicode script detection (either triggers Kannada mode)
    kannada = (ui_language == "kn") or is_kannada(user_message)
    language = "kn" if kannada else "en"

    # ── Priority 1: FIR number lookup ────────────────────────────────────────
    fir_num = extract_fir_number(user_message)
    if fir_num or any(kw in msg_lower for kw in ["fir/", "fir number", "fir no", "case no", "case number"]):
        # Build a smart FIR query
        if fir_num:
            sql = f"SELECT fir_number, date, time, district, taluk, police_station, crime_type, ipc_section, severity, status, description, victim_count, accused_count, property_value FROM crimes WHERE UPPER(fir_number) = '{fir_num}' LIMIT 1"
        else:
            # Try to find any FIR-like token in the message
            tokens = [t for t in re.split(r'\s+', user_message) if '/' in t and len(t) > 4]
            search_term = tokens[0] if tokens else user_message.strip()
            sql = f"SELECT fir_number, date, time, district, taluk, police_station, crime_type, ipc_section, severity, status, description, victim_count, accused_count, property_value FROM crimes WHERE fir_number LIKE '%{search_term}%' LIMIT 5"
        try:
            result = db.execute(text(sql))
            columns = list(result.keys())
            rows = result.fetchall()
            if rows:
                # Single FIR → rich card; multiple → table
                if len(rows) == 1:
                    formatted = format_fir_detail(rows[0], columns)
                    answer = f"🔍 **Case Details Found**\n\n{formatted}"
                else:
                    formatted = format_sql_results(rows, columns)
                    answer = f"🔍 **{len(rows)} Matching FIR(s) Found**\n\n{formatted}"
                status_val = rows[0][9] if len(rows[0]) > 9 else 'N/A'
                if kannada:
                    insights = [
                        f"{len(rows)} ಪ್ರಕರಣ(ಗಳು) ಕಂಡುಬಂದಿವೆ",
                        f"ಪ್ರಕರಣ ಸ್ಥಿತಿ: {status_val}",
                        "ಪೂರ್ಣ ತನಿಖಾ ಸಲಹೆಗಳಿಗಾಗಿ ಕೇಸ್ ಇಂಟೆಲಿಜೆನ್ಸ್ ಮಾಡ್ಯೂಲ್ ಬಳಸಿ"
                    ]
                else:
                    insights = [
                        f"Found {len(rows)} case(s) matching your query",
                        f"Case status: {status_val}",
                        "Use Case Intelligence module for full AI-generated lead suggestions"
                    ]
                return {
                    "answer": answer,
                    "sql": sql,
                    "insights": insights,
                    "result_count": len(rows),
                    "language": language
                }
            else:
                if kannada:
                    not_found = f"❌ **FIR ಪ್ರಕರಣ ಕಂಡುಬಂದಿಲ್ಲ** `{fir_num or user_message.strip()}`\n\nದಯವಿಟ್ಟು FIR ಸಂಖ್ಯೆಯ ರೂಪವನ್ನು ಪರಿಶೀಲಿಸಿ (ಉದಾ: `FIR/2024/10001`)."
                    not_found_insights = ["ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಹೊಂದಾಣಿಕೆ ದಾಖಲೆ ಇಲ್ಲ", "ಭಾಗಶಃ FIR ಸಂಖ್ಯೆ ಬಳಸಿ ಹುಡುಕಲು ಪ್ರಯತ್ನಿಸಿ"]
                else:
                    not_found = f"❌ **No case found** for FIR `{fir_num or user_message.strip()}`.\n\nPlease verify the FIR number format (e.g., `FIR/2024/10001`) or try the **Case Intelligence** module."
                    not_found_insights = ["No matching record in database", "Try using partial FIR numbers for broader search"]
                return {
                    "answer": not_found,
                    "sql": sql,
                    "insights": not_found_insights,
                    "result_count": 0,
                    "language": language
                }
        except Exception as e:
            print(f"FIR lookup error: {e}")

    # ── Priority 1.5: Database-backed Suspect Name Search ─────────────────────
    words = [w.strip("?,.!-()\"'") for w in user_message.split() if len(w) >= 2]
    stop_words = {
        "tell", "about", "show", "who", "what", "where", "how", "many", "committed", 
        "suspect", "accused", "criminal", "cases", "crimes", "district", "station", 
        "police", "info", "details", "profile", "search", "find", "case", "with", 
        "for", "the", "and", "under", "incident", "description", "here", "are", 
        "any", "get", "view", "list", "name", "me", "my", "him", "her", "his", 
        "them", "their", "they", "you", "your", "we", "us", "our", "is", "am", 
        "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", 
        "did", "a", "an", "in", "on", "at", "to", "from", "by", "of", "please", 
        "give", "information", "record", "records", "ಬಗ್ಗೆ", "ಹೇಳಿ", "ಮಾಹಿತಿ", 
        "ನನಗೆ", "ತೋರಿಸಿ", "ತಿಳಿಸಿ", "ಯಾರು", "ಏನು", "ಎಲ್ಲಿ", "ಹೇಗೆ"
    }
    search_terms = [w for w in words if w.lower() not in stop_words]

    
    is_crime_query = any(k in msg_lower for k in ["crime", "case", "fir", "incident", "offense", "occurrence", "ಪ್ರಕರಣ"])
    
    if search_terms and not is_crime_query:
        try:
            # Check if all search terms are present in name/alias/district/occupation
            like_clauses = " AND ".join([f"LOWER(name || ' ' || alias || ' ' || district || ' ' || occupation) LIKE :term_{i}" for i in range(len(search_terms))])
            sql_suspects = f"SELECT id, name, alias, age, gender, district, occupation, risk_level, crime_history FROM suspects WHERE {like_clauses} LIMIT 5"
            params = {f"term_{i}": f"%{term.lower()}%" for i, term in enumerate(search_terms)}
            
            res = db.execute(text(sql_suspects), params)
            suspect_rows = res.fetchall()
            
            if suspect_rows:
                lines = []
                for row in suspect_rows:
                    s_id, s_name, s_alias, s_age, s_gender, s_dist, s_occ, s_risk, s_history = row
                    if kannada:
                        lines.append(f"🕵️ **ಶಂಕಿತರ ಪ್ರೊಫೈಲ್: {s_name} ({s_alias})**")
                        lines.append(f"• **ವಯಸ್ಸು/ಲಿಂಗ:** {s_age} / {s_gender}")
                        lines.append(f"• **ಜಿಲ್ಲೆ:** {s_dist}")
                        lines.append(f"• **ಉದ್ಯೋಗ:** {s_occ}")
                        lines.append(f"• **ಅಪಾಯದ ಮಟ್ಟ:** {s_risk}")
                    else:
                        lines.append(f"🕵️ **Suspect Profile: {s_name} ({s_alias})**")
                        lines.append(f"• **Age/Gender:** {s_age} / {s_gender}")
                        lines.append(f"• **District:** {s_dist}")
                        lines.append(f"• **Occupation:** {s_occ}")
                        lines.append(f"• **Risk Level:** {s_risk}")
                    
                    if s_history:
                        crime_ids = [c.strip() for c in s_history.split(",") if c.strip()]
                        if crime_ids:
                            in_clause = ",".join([f":c_{j}" for j in range(len(crime_ids))])
                            crime_params = {f"c_{j}": cid for j, cid in enumerate(crime_ids)}
                            sql_crimes = f"SELECT fir_number, crime_type, status, date FROM crimes WHERE id IN ({in_clause}) LIMIT 5"
                            cr_res = db.execute(text(sql_crimes), crime_params)
                            cr_rows = cr_res.fetchall()
                            if cr_rows:
                                if kannada:
                                    lines.append("• **ಸಂಬಂಧಿತ ಆಪರಾಧಗಳು:**")
                                    for cr in cr_rows:
                                        lines.append(f"  - `{cr[0]}`: {cr[1]} ({cr[2]} ರಂದು {cr[3]})")
                                else:
                                    lines.append("• **Associated Crimes / Offenses:**")
                                    for cr in cr_rows:
                                        lines.append(f"  - `{cr[0]}`: {cr[1]} ({cr[2]} on {cr[3]})")
                    lines.append("")
                
                answer = "\n".join(lines)
                insights = [
                    f"ಡೇಟಾಬೇಸ್‌ನಿಂದ {len(suspect_rows)} ಶಂಕಿತರ ವಿವರಗಳು ಲಭ್ಯವಾಗಿವೆ" if kannada else f"Found {len(suspect_rows)} suspect(s) matching '{' '.join(search_terms)}'",
                    "ಪೊಲೀಸ್ ಇಂಟೆಲಿಜೆನ್ಸ್ ಸಿಸ್ಟಮ್ ಆಧರಿತ ಮಾಹಿತಿ" if kannada else "Suspect details retrieved from active police database",
                    "ಸಂಬಂಧಿತ ಅಪರಾಧ ಇತಿಹಾಸದಿಂದ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ" if kannada else "Cross-referenced crimes from associated crime history"
                ]
                return {
                    "answer": answer,
                    "sql": sql_suspects,
                    "insights": insights,
                    "result_count": len(suspect_rows),
                    "language": language
                }
        except Exception as search_err:
            print(f"Priority 1.5 suspect search error: {search_err}")

    # ── Priority 2: Keyword pattern matching ─────────────────────────────────
    # In Kannada mode: try Kannada keyword patterns first, then English patterns as fallback
    # (user may click English suggested queries while in Kannada mode)
    matched = None
    best_score = 0
    search_pools = [KANNADA_PATTERNS, MOCK_PATTERNS] if kannada else [MOCK_PATTERNS]
    for pool in search_pools:
        for pattern in pool:
            score = sum(1 for kw in pattern["keywords"] if kw.lower() in msg_lower)
            if score > best_score:
                best_score = score
                matched = pattern
        if matched and best_score > 0:
            break  # Found a match in the preferred pool

    # ── Priority 3: Final Fallback to Crime Search or Defaults ───────────────
    if not matched or best_score == 0:
        if search_terms:
            try:
                # Search crimes table using AND logic for all terms
                like_clauses_crimes = " AND ".join([f"LOWER(crime_type || ' ' || district || ' ' || police_station || ' ' || description || ' ' || taluk) LIKE :term_{i}" for i in range(len(search_terms))])
                sql_crimes = f"SELECT fir_number, date, time, district, taluk, police_station, crime_type, ipc_section, severity, status, description FROM crimes WHERE {like_clauses_crimes} LIMIT 5"
                params = {f"term_{i}": f"%{term.lower()}%" for i, term in enumerate(search_terms)}
                res_cr = db.execute(text(sql_crimes), params)
                crime_rows = res_cr.fetchall()
                if crime_rows:
                    lines = []
                    for cr in crime_rows:
                        if kannada:
                            lines.append(f"📁 **FIR:** `{cr[0]}` | **ಪ್ರಕಾರ:** {cr[6]} | **ಗಂಭೀರತೆ:** {cr[8]} | **ಸ್ಥಿತಿ:** {cr[9]}")
                            lines.append(f"• **ದಿನಾಂಕ:** {cr[1]} {cr[2]} | **ಸ್ಥಳ:** {cr[3]} ({cr[4]} -> {cr[5]})")
                            lines.append(f"• **ವಿವರಗಳು:** {cr[10]}")
                        else:
                            lines.append(f"📁 **FIR:** `{cr[0]}` | **Type:** {cr[6]} | **Severity:** {cr[8]} | **Status:** {cr[9]}")
                            lines.append(f"• **Date:** {cr[1]} {cr[2]} | **Location:** {cr[3]} ({cr[4]} -> {cr[5]})")
                            lines.append(f"• **Details:** {cr[10]}")
                        lines.append("")
                    
                    answer = (f"🔍 **ಹೊಂದಾಣಿಕೆಯಾಗುವ ಪ್ರಕರಣಗಳು ಕಂಡುಬಂದಿವೆ**\n\n" if kannada else f"🔍 **Matching Cases Found**\n\n") + "\n".join(lines)
                    insights = [
                        f"ಒಟ್ಟು {len(crime_rows)} ಪ್ರಕರಣಗಳು ಹೊಂದಾಣಿಕೆಯಾಗಿವೆ" if kannada else f"Found {len(crime_rows)} crime case(s) matching '{' '.join(search_terms)}'",
                        "ರಾಜ್ಯ ಅಪರಾಧ ದಾಖಲೆಗಳ ಡೇಟಾಬೇಸ್‌ನಿಂದ ಪಡೆಯಲಾಗಿದೆ" if kannada else "Sourced from the state crime record database",
                        "ಪ್ರಕರಣದ ನವೀಕರಣಕ್ಕೆ ಪ್ರಕರಣ ತನಿಖೆ ಮಾಡ್ಯೂಲ್ ಬಳಸಿ" if kannada else "Use the Case Intelligence stepper to update case status"
                    ]
                    return {
                        "answer": answer,
                        "sql": sql_crimes,
                        "insights": insights,
                        "result_count": len(crime_rows),
                        "language": language
                    }
            except Exception as search_err:
                print(f"Dynamic fallback crime search error: {search_err}")

        matched = MOCK_PATTERNS[1]  # Default to top districts

    try:
        sql = matched.get("sql", "")
        result = db.execute(text(sql))
        columns = list(result.keys())
        rows = result.fetchall()
        formatted = format_sql_results(rows, columns)
        answer = matched["template"].format(data=formatted)
        # Translate standard insights to Kannada when in Kannada mode
        if kannada:
            insights = [
                f"ಡೇಟಾಬೇಸ್‌ನಿಂದ {len(rows)} ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿವೆ",
                "ಕರ್ನಾಟಕದ 1100+ ಪೊಲೀಸ್ ಠಾಣೆಗಳ ಮಾಹಿತಿ ಆಧಾರಿತ",
                "2018-2024 ಐತಿಹಾಸಿಕ ದಾಖಲೆಗಳ ವಿಶ್ಲೇಷಣೆ"
            ]
        else:
            insights = [
                f"Query returned {len(rows)} records from the database",
                "Data sourced from 1100+ police stations across Karnataka",
                "Analysis based on historical records from 2018-2024"
            ]
        return {
            "answer": answer,
            "sql": sql,
            "insights": insights,
            "result_count": len(rows),
            "language": language
        }
    except Exception as e:
        print(f"Mock response error: {e}")
        err_msg = "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಸಂಸ್ಕರಿಸಲು ದೋಷ ಉಂಟಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ." if kannada else "I encountered an error processing your query. Please try rephrasing."
        return {
            "answer": err_msg,
            "sql": "",
            "insights": [],
            "result_count": 0,
            "language": language
        }


async def get_gemini_response(user_message: str, conversation_history: list, db, ui_language: str = "en") -> dict:
    language = "kn" if (ui_language == "kn" or is_kannada(user_message)) else "en"
    fir_num = extract_fir_number(user_message)

    if not GEMINI_API_KEY or GEMINI_API_KEY == "TEST_DISABLED":
        return get_mock_response(user_message, db, ui_language)

    # 1. Step 1: SQL Generation Loop (or direct FIR lookup)
    max_retries = 3
    attempt = 0
    feedback_msg = ""
    history_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in conversation_history[-8:]])
    client = get_httpx_client()

    sql_query = ""
    sql_results = []
    sql_cols = []
    sql_err_occurred = False

    if fir_num:
        sql_query = f"SELECT fir_number, date, time, district, taluk, police_station, crime_type, ipc_section, severity, status, description, victim_count, accused_count, property_value FROM crimes WHERE UPPER(fir_number) = '{fir_num}' LIMIT 1"
        try:
            result = db.execute(text(sql_query))
            sql_cols = list(result.keys())
            sql_results = result.fetchall()
        except Exception as e:
            print(f"FIR fetch error: {e}")
            sql_err_occurred = True
    else:
        while attempt <= max_retries:
            try:
                if attempt == 0:
                    prompt = f"{SQL_GENERATION_PROMPT}\n\nCONVERSATION HISTORY:\n{history_text}\n\nUSER: {user_message}\n\nRespond with ONLY a valid JSON object (no markdown, no code fences)."
                else:
                    prompt = (
                        f"{SQL_GENERATION_PROMPT}\n\nCONVERSATION HISTORY:\n{history_text}\n\nUSER: {user_message}\n\n"
                        f"{feedback_msg}\n\n"
                        f"Please inspect the database schema, correct the syntax, and output a valid SQL statement in the JSON object (no markdown, no code fences)."
                    )

                url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
                payload = {"contents": [{"parts": [{"text": prompt}]}]}

                resp = await client.post(url, json=payload, headers={"X-goog-api-key": GEMINI_API_KEY})
                if resp.status_code != 200:
                    print(f"Gemini SQL Gen error {resp.status_code}: {resp.text[:200]}")
                    return get_mock_response(user_message, db, ui_language)

                data = resp.json()
                raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                raw = re.sub(r'^```json\s*', '', raw)
                raw = re.sub(r'\s*```$', '', raw)
                raw = re.sub(r'^```\s*', '', raw)
                parsed = json.loads(raw)

                sql_query = parsed.get("sql", "")
                if not sql_query or not sql_query.strip().upper().startswith("SELECT"):
                    break

                try:
                    result = db.execute(text(sql_query))
                    sql_cols = list(result.keys())
                    sql_results = result.fetchall()
                    sql_err_occurred = False
                    break
                except Exception as sql_err:
                    print(f"SQL exec error on attempt {attempt}: {sql_err}")
                    feedback_msg = f"The SQL query you generated: `{sql_query}` failed with error: `{str(sql_err)}`."
                    sql_err_occurred = True
                    attempt += 1
                    continue

            except Exception as e:
                print(f"Gemini exception during SQL Gen attempt {attempt}: {e}")
                attempt += 1
                if attempt > max_retries:
                    return get_mock_response(user_message, db, ui_language)

    if sql_err_occurred:
        return get_mock_response(user_message, db, ui_language)

    # 2. Step 2: Answer Synthesis
    try:
        formatted_db_data = ""
        if sql_query and sql_query.strip().upper().startswith("SELECT"):
            formatted_db_data = f"\n\nDATABASE QUERY: {sql_query}\nRETRIEVED DATA:\n" + format_sql_results(sql_results, sql_cols)
        else:
            formatted_db_data = "\n\nDATABASE QUERY: None (Not requested/needed for this type of query)."

        lang_instruction = LANG_INSTRUCTIONS.get(language, LANG_INSTRUCTIONS["en"])
        synthesis_prompt = f"{ANSWER_SYNTHESIS_PROMPT}\n{lang_instruction}\n\nCONVERSATION HISTORY:\n{history_text}{formatted_db_data}\n\nUSER: {user_message}\n\nRespond with ONLY a valid JSON object (no markdown, no code fences)."

        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
        payload = {"contents": [{"parts": [{"text": synthesis_prompt}]}]}

        resp = await client.post(url, json=payload, headers={"X-goog-api-key": GEMINI_API_KEY})
        if resp.status_code != 200:
            print(f"Gemini Synthesis error {resp.status_code}: {resp.text[:200]}")
            return get_mock_response(user_message, db, ui_language)

        data = resp.json()
        raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        raw = re.sub(r'^```json\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        raw = re.sub(r'^```\s*', '', raw)
        parsed = json.loads(raw)

        # Handle formatting for cases
        answer = parsed.get("answer", "")
        if fir_num and sql_results and (not answer or len(answer) < 50):
            answer = f"🔍 **Case Details Found**\n\n{format_fir_detail(sql_results[0], sql_cols)}"

        return {
            "answer": answer or "I could not synthesize a response.",
            "sql": sql_query,
            "insights": parsed.get("insights", []),
            "result_count": len(sql_results),
            "language": language
        }

    except Exception as e:
        print(f"Gemini Synthesis exception: {e}")
        return get_mock_response(user_message, db, ui_language)
