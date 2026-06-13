import random
import json
import bcrypt
from datetime import datetime, timedelta
from database import SessionLocal, create_tables, Crime, Suspect, Victim, PoliceStation, User, Prediction, FinancialAccount, FinancialTransaction

KARNATAKA_DISTRICTS = {
    "Bengaluru Urban": {"lat": 12.9716, "lon": 77.5946, "taluks": ["Bengaluru North", "Bengaluru South", "Bengaluru East", "Yelahanka", "Krishnarajapura"]},
    "Mysuru": {"lat": 12.2958, "lon": 76.6394, "taluks": ["Mysuru", "Nanjangud", "Hunsur", "Periyapatna", "Krishnarajanagara"]},
    "Hubballi-Dharwad": {"lat": 15.3647, "lon": 75.1240, "taluks": ["Hubballi", "Dharwad", "Kundgol", "Navalgund", "Kalghatgi"]},
    "Mangaluru": {"lat": 12.9141, "lon": 74.8560, "taluks": ["Mangaluru", "Bantwal", "Belthangady", "Sullia", "Puttur"]},
    "Belagavi": {"lat": 15.8497, "lon": 74.4977, "taluks": ["Belagavi", "Gokak", "Khanapur", "Raibag", "Hukkeri"]},
    "Kalaburagi": {"lat": 17.3297, "lon": 76.8343, "taluks": ["Kalaburagi", "Aland", "Chincholi", "Jevargi", "Afzalpur"]},
    "Ballari": {"lat": 15.1394, "lon": 76.9214, "taluks": ["Ballari", "Sandur", "Hospet", "Siruguppa", "Hadagali"]},
    "Vijayapura": {"lat": 16.8302, "lon": 75.7100, "taluks": ["Vijayapura", "Sindagi", "Indi", "Basavana Bagewadi", "Muddebihal"]},
    "Shivamogga": {"lat": 13.9299, "lon": 75.5681, "taluks": ["Shivamogga", "Sagar", "Shimoga", "Thirthahalli", "Hosanagara"]},
    "Tumakuru": {"lat": 13.3409, "lon": 77.1010, "taluks": ["Tumakuru", "Tiptur", "Madhugiri", "Pavagada", "Sira"]},
    "Raichur": {"lat": 16.2120, "lon": 77.3439, "taluks": ["Raichur", "Manvi", "Sindhanur", "Devadurga", "Lingsugur"]},
    "Bidar": {"lat": 17.9104, "lon": 77.5199, "taluks": ["Bidar", "Bhalki", "Basavakalyan", "Humnabad", "Aurad"]},
    "Yadgir": {"lat": 16.7710, "lon": 77.1384, "taluks": ["Yadgir", "Shorapur", "Shahapur", "Gurmatkal", "Wadagera"]},
    "Dharwad": {"lat": 15.4589, "lon": 75.0078, "taluks": ["Dharwad", "Hubli", "Kalghatgi", "Navalgund", "Kundgol"]},
    "Gadag": {"lat": 15.4166, "lon": 75.6167, "taluks": ["Gadag", "Shirhatti", "Ron", "Nargund", "Mundargi"]},
    "Haveri": {"lat": 14.7939, "lon": 75.4006, "taluks": ["Haveri", "Ranebennur", "Byadagi", "Hirekerur", "Savanur"]},
    "Uttara Kannada": {"lat": 14.7953, "lon": 74.6895, "taluks": ["Karwar", "Sirsi", "Siddapur", "Yellapur", "Ankola"]},
    "Dakshina Kannada": {"lat": 12.8438, "lon": 75.2479, "taluks": ["Mangaluru", "Bantwal", "Belthangady", "Sullia", "Moodbidri"]},
    "Udupi": {"lat": 13.3409, "lon": 74.7421, "taluks": ["Udupi", "Kundapur", "Karkala", "Brahmaavar", "Kapu"]},
    "Chikkamagaluru": {"lat": 13.3161, "lon": 75.7720, "taluks": ["Chikkamagaluru", "Kadur", "Tarikere", "Birur", "Mudigere"]},
    "Hassan": {"lat": 13.0033, "lon": 76.1004, "taluks": ["Hassan", "Belur", "Alur", "Sakleshpur", "Arakalagudu"]},
    "Kodagu": {"lat": 12.4244, "lon": 75.7382, "taluks": ["Madikeri", "Somwarpet", "Virajpet", "Kushalnagar", "Ponnampet"]},
    "Mandya": {"lat": 12.5218, "lon": 76.8951, "taluks": ["Mandya", "Maddur", "Malavalli", "Nagamangala", "Krishnarajapet"]},
    "Chamarajanagar": {"lat": 11.9261, "lon": 76.9442, "taluks": ["Chamarajanagar", "Gundlupet", "Kollegal", "Hanur", "Yelandur"]},
    "Ramanagara": {"lat": 12.7157, "lon": 77.2819, "taluks": ["Ramanagara", "Channapatna", "Magadi", "Kanakapura", "Sathanur"]},
    "Chikkaballapur": {"lat": 13.4355, "lon": 77.7315, "taluks": ["Chikkaballapur", "Sidlaghatta", "Chintamani", "Gouribidanur", "Bagepalli"]},
    "Kolar": {"lat": 13.1367, "lon": 78.1292, "taluks": ["Kolar", "Mulbagal", "Malur", "Srinivaspur", "Bangarpet"]},
    "Bengaluru Rural": {"lat": 13.1986, "lon": 77.7066, "taluks": ["Devanahalli", "Doddaballapur", "Hosakote", "Nelamangala", "Hoskote"]},
    "Chitradurga": {"lat": 14.2251, "lon": 76.4014, "taluks": ["Chitradurga", "Hiriyur", "Holalkere", "Hosadurga", "Molakalmuru"]},
    "Davanagere": {"lat": 14.4644, "lon": 75.9218, "taluks": ["Davanagere", "Channagiri", "Honnali", "Harihara", "Nyamathi"]},
    "Koppal": {"lat": 15.3508, "lon": 76.1549, "taluks": ["Koppal", "Gangavathi", "Yelburga", "Kushtagi", "Kustagi"]},
}

CRIME_TYPES = [
    ("Murder", "302 IPC", "Critical"),
    ("Attempt to Murder", "307 IPC", "High"),
    ("Robbery", "392 IPC", "High"),
    ("Theft", "379 IPC", "Medium"),
    ("Burglary", "457 IPC", "Medium"),
    ("Cybercrime", "66C IT Act", "Medium"),
    ("Assault", "324 IPC", "High"),
    ("Fraud", "420 IPC", "Medium"),
    ("Drug Offense", "NDPS Act", "High"),
    ("Kidnapping", "363 IPC", "Critical"),
    ("POCSO", "POCSO Act", "Critical"),
    ("Domestic Violence", "498A IPC", "High"),
    ("Rape", "376 IPC", "Critical"),
    ("Extortion", "384 IPC", "High"),
    ("Chain Snatching", "379 IPC", "Medium"),
    ("Vehicle Theft", "379 IPC", "Medium"),
    ("Hit and Run", "304A IPC", "High"),
    ("Cheating", "417 IPC", "Low"),
    ("Arson", "435 IPC", "High"),
    ("Rioting", "147 IPC", "High"),
]

STATUS_OPTIONS = ["Filed", "Under Investigation", "Chargesheeted", "Closed", "Acquitted"]
OCCUPATIONS = ["Student", "Farmer", "Laborer", "Driver", "Shopkeeper", "Unemployed", "IT Professional", "Contractor", "Mechanic", "Trader"]
RISK_LEVELS = ["Low", "Medium", "High"]

SEASONAL_WEIGHTS = {
    1: 0.85, 2: 0.80, 3: 0.90, 4: 0.95,
    5: 1.00, 6: 0.85, 7: 0.80, 8: 0.82,
    9: 0.90, 10: 1.15, 11: 1.20, 12: 1.10
}

def random_date(year):
    month = random.choices(list(range(1,13)), weights=list(SEASONAL_WEIGHTS.values()))[0]
    day = random.randint(1, 28)
    return f"{year}-{month:02d}-{day:02d}", month

def jitter(lat, lon, scale=0.15):
    return lat + random.uniform(-scale, scale), lon + random.uniform(-scale, scale)

def seed_police_stations(db):
    print("  Seeding police stations...")
    station_id = 1
    stations = []
    for district, info in KARNATAKA_DISTRICTS.items():
        for taluk in info["taluks"]:
            for ps_num in range(random.randint(6, 12)):
                ps_name = f"{taluk} PS-{ps_num+1}" if ps_num > 0 else f"{taluk} Town PS"
                lat, lon = jitter(info["lat"], info["lon"], 0.2)
                ps = PoliceStation(
                    name=ps_name, district=district, taluk=taluk,
                    officer_count=random.randint(15, 80),
                    cases_filed=random.randint(50, 500),
                    cases_solved=random.randint(30, 350),
                    latitude=lat, longitude=lon
                )
                stations.append(ps)
    db.bulk_save_objects(stations)
    db.commit()
    print(f"    → {len(stations)} stations created")
    return stations

def seed_crimes(db):
    print("  Seeding crime records (this may take a moment)...")
    ps_list = db.query(PoliceStation).all()
    crimes = []
    fir_counter = 10001
    for year in range(2018, 2025):
        for district, info in KARNATAKA_DISTRICTS.items():
            district_ps = [p for p in ps_list if p.district == district]
            num_crimes = random.randint(800, 2200)
            for _ in range(num_crimes):
                date_str, month = random_date(year)
                crime_type, ipc, severity = random.choice(CRIME_TYPES)
                ps = random.choice(district_ps) if district_ps else None
                lat, lon = jitter(info["lat"], info["lon"], 0.3)
                crime = Crime(
                    fir_number=f"FIR/{year}/{fir_counter}",
                    date=date_str, time=f"{random.randint(0,23):02d}:{random.randint(0,59):02d}",
                    year=year, month=month,
                    district=district, taluk=ps.taluk if ps else list(KARNATAKA_DISTRICTS[district]["taluks"])[0],
                    police_station=ps.name if ps else "Unknown PS",
                    crime_type=crime_type, ipc_section=ipc, severity=severity,
                    status=random.choices(STATUS_OPTIONS, weights=[10,30,25,30,5])[0],
                    latitude=lat, longitude=lon,
                    description=f"{crime_type} case reported at {ps.name if ps else district}",
                    victim_count=random.randint(1, 4),
                    accused_count=random.randint(1, 6),
                    property_value=random.uniform(0, 500000) if crime_type in ["Robbery","Theft","Fraud","Burglary"] else 0.0
                )
                crimes.append(crime)
                fir_counter += 1
                if len(crimes) >= 500:
                    db.bulk_save_objects(crimes)
                    db.commit()
                    crimes = []
    if crimes:
        db.bulk_save_objects(crimes)
        db.commit()
    total = db.query(Crime).count()
    print(f"    → {total} crime records created")

def seed_suspects(db):
    print("  Seeding suspects & network...")
    first_names = ["Rajan", "Suresh", "Mahesh", "Prakash", "Ramesh", "Kiran", "Vijay", "Arun", "Mohan", "Santosh",
                   "Syed", "Mohammed", "Abdul", "Imran", "Farooq", "Priya", "Rekha", "Anita", "Suma", "Kavitha"]
    last_names = ["Kumar", "Reddy", "Gowda", "Naik", "Rao", "Patil", "Hegde", "Shetty", "Nair", "Pillai",
                  "Khan", "Shaikh", "Patel", "Shah", "Joshi", "Sharma", "Verma", "Singh", "Yadav", "Gupta"]
    suspects = []
    districts = list(KARNATAKA_DISTRICTS.keys())
    for i in range(600):
        connections = ",".join(str(random.randint(1, 600)) for _ in range(random.randint(1, 5)))
        crime_ids = ",".join(str(random.randint(1, 50000)) for _ in range(random.randint(1, 8)))
        suspects.append(Suspect(
            name=f"{random.choice(first_names)} {random.choice(last_names)}",
            alias=f"@{random.choice(['Tiger','Snake','Ghost','Shadow','King','Fox','Wolf'])}{random.randint(10,99)}",
            age=random.randint(18, 60),
            gender=random.choices(["Male","Female"], weights=[85,15])[0],
            district=random.choice(districts),
            occupation=random.choice(OCCUPATIONS),
            crime_history=crime_ids,
            connections=connections,
            risk_level=random.choices(RISK_LEVELS, weights=[40,35,25])[0],
        ))
    db.bulk_save_objects(suspects)
    db.commit()
    print(f"    → 600 suspects with network connections")

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_users(db):
    print("  Seeding demo users...")
    users = [
        User(username="admin", hashed_password=hash_password("admin123"), full_name="Super Administrator",
             role="super_admin", district="All", is_active=True),
        User(username="sp_bengaluru", hashed_password=hash_password("password123"), full_name="SP Bengaluru Urban",
             role="district_sp", district="Bengaluru Urban", is_active=True),
        User(username="investigator1", hashed_password=hash_password("password123"), full_name="SI Ramesh Kumar",
             role="investigator", district="Mysuru", is_active=True),
        User(username="analyst1", hashed_password=hash_password("password123"), full_name="Data Analyst Priya",
             role="analyst", district="All", is_active=True),
        User(username="readonly1", hashed_password=hash_password("password123"), full_name="Viewer User",
             role="readonly", district="Bengaluru Urban", is_active=True),
    ]
    db.bulk_save_objects(users)
    db.commit()
    print("    → 5 demo users created")

def seed_predictions(db):
    print("  Seeding predictive alerts...")
    crime_types_pred = ["Murder", "Robbery", "Theft", "Cybercrime", "Drug Offense", "Chain Snatching"]
    districts = list(KARNATAKA_DISTRICTS.keys())
    preds = []
    for district in districts:
        for ct in random.sample(crime_types_pred, 3):
            confidence = random.uniform(0.65, 0.95)
            predicted = random.randint(10, 200)
            severity = "Critical" if predicted > 150 else ("Warning" if predicted > 80 else "Normal")
            trend = random.choice(["Rising", "Rising", "Stable", "Falling"])
            preds.append(Prediction(
                district=district, crime_type=ct,
                predicted_month="2025-01",
                predicted_count=predicted,
                confidence=round(confidence, 2),
                severity=severity, trend=trend
            ))
    db.bulk_save_objects(preds)
    db.commit()
    print(f"    → {len(preds)} predictions generated")

def seed_financial_data(db):
    print("  Seeding financial accounts & transactions...")
    if db.query(FinancialAccount).count() > 10:
        print("    → Already seeded.")
        return
    banks = ["SBI", "Canara Bank", "HDFC", "ICICI", "Axis Bank", "PNB", "Crypto Wallet", "Hawala Network"]
    account_types = ["Savings", "Current", "Crypto", "Hawala"]
    flag_reasons = [
        "Multiple large cash withdrawals within 48 hours",
        "Structured transactions to avoid threshold reporting",
        "Transactions to known criminal associates",
        "Unusual Crypto-to-cash conversion pattern",
        "Round-amount transfers consistent with hawala",
    ]
    # Get high-risk suspects
    suspects = db.query(Suspect).filter(Suspect.risk_level == "High").limit(80).all()
    accounts = []
    for s in suspects:
        n_accounts = random.randint(1, 3)
        for j in range(n_accounts):
            is_flagged = random.random() < 0.55
            acc = FinancialAccount(
                suspect_id=s.id,
                account_number=f"ACC{random.randint(10000000, 99999999)}",
                bank_name=random.choice(banks),
                account_type=random.choice(account_types),
                flagged=is_flagged,
                flag_reason=random.choice(flag_reasons) if is_flagged else None,
            )
            accounts.append(acc)
    db.bulk_save_objects(accounts)
    db.commit()
    # Seed transactions between accounts
    all_acc = db.query(FinancialAccount).all()
    if len(all_acc) < 2:
        return
    txns = []
    months = [f"2024-{m:02d}-{random.randint(1,28):02d}" for m in range(1, 13)]
    tx_types = ["Transfer", "Withdrawal", "Crypto", "Cash Deposit"]
    for _ in range(500):
        from_acc = random.choice(all_acc)
        to_acc = random.choice(all_acc)
        if from_acc.id == to_acc.id:
            continue
        amount = random.choices(
            [random.uniform(5000, 50000), random.uniform(50001, 500000), random.uniform(500001, 2000000)],
            weights=[60, 30, 10]
        )[0]
        is_suspicious = from_acc.flagged or to_acc.flagged or amount > 200000
        txns.append(FinancialTransaction(
            from_account=from_acc.id,
            to_account=to_acc.id,
            amount=round(amount, 2),
            date=random.choice(months),
            suspicious=is_suspicious,
            flag_reason=random.choice(flag_reasons) if is_suspicious else None,
            transaction_type=random.choice(tx_types),
        ))
    db.bulk_save_objects(txns)
    db.commit()
    print(f"    → {len(accounts)} accounts + {len(txns)} transactions seeded")


def run_seed():
    print("\n🚀 Starting SCRB Database Seeding...")
    create_tables()
    db = SessionLocal()
    try:
        if db.query(Crime).count() > 100:
            print("✅ Database already seeded. Skipping.")
            return
        seed_users(db)
        seed_police_stations(db)
        seed_crimes(db)
        seed_suspects(db)
        seed_predictions(db)
        seed_financial_data(db)
        print("\n✅ Seeding complete! Database ready.\n")
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
