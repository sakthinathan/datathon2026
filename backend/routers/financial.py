from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, FinancialAccount, FinancialTransaction
from routers.auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/financial", tags=["financial"])


@router.get("/suspicious-transactions")
async def suspicious_transactions(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """All transactions flagged as suspicious"""
    result = db.execute(text("""
        SELECT ft.id, ft.amount, ft.date, ft.transaction_type, ft.flag_reason,
               fa_from.account_number as from_acc, fa_from.bank_name as from_bank,
               fa_to.account_number as to_acc, fa_to.bank_name as to_bank,
               s.name as suspect_name, s.risk_level
        FROM financial_transactions ft
        LEFT JOIN financial_accounts fa_from ON ft.from_account = fa_from.id
        LEFT JOIN financial_accounts fa_to ON ft.to_account = fa_to.id
        LEFT JOIN suspects s ON fa_from.suspect_id = s.id
        WHERE ft.suspicious = 1
        ORDER BY ft.amount DESC
        LIMIT :lim
    """), {"lim": limit})
    rows = result.fetchall()
    return [{
        "id": r[0], "amount": r[1], "date": r[2], "transaction_type": r[3],
        "flag_reason": r[4], "from_account": r[5], "from_bank": r[6],
        "to_account": r[7], "to_bank": r[8], "suspect_name": r[9], "risk_level": r[10]
    } for r in rows]


@router.get("/money-trail/{suspect_id}")
async def money_trail(
    suspect_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """All financial accounts and transactions linked to a suspect"""
    accounts = db.execute(text("""
        SELECT id, account_number, bank_name, account_type, flagged, flag_reason
        FROM financial_accounts WHERE suspect_id = :sid
    """), {"sid": suspect_id}).fetchall()

    account_ids = [r[0] for r in accounts]
    transactions = []
    if account_ids:
        placeholders = ",".join(str(i) for i in account_ids)
        txn_result = db.execute(text(f"""
            SELECT ft.id, ft.amount, ft.date, ft.transaction_type, ft.suspicious,
                   fa_from.account_number, fa_to.account_number
            FROM financial_transactions ft
            LEFT JOIN financial_accounts fa_from ON ft.from_account = fa_from.id
            LEFT JOIN financial_accounts fa_to ON ft.to_account = fa_to.id
            WHERE ft.from_account IN ({placeholders}) OR ft.to_account IN ({placeholders})
            ORDER BY ft.amount DESC LIMIT 30
        """))
        transactions = [{
            "id": r[0], "amount": r[1], "date": r[2], "type": r[3],
            "suspicious": bool(r[4]), "from_account": r[5], "to_account": r[6]
        } for r in txn_result.fetchall()]

    return {
        "suspect_id": suspect_id,
        "accounts": [{"id": r[0], "account_number": r[1], "bank_name": r[2],
                      "account_type": r[3], "flagged": bool(r[4]), "flag_reason": r[5]}
                     for r in accounts],
        "transactions": transactions,
        "total_suspicious": sum(1 for t in transactions if t["suspicious"])
    }


@router.get("/network-graph")
async def financial_network_graph(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """D3-compatible node/link format for money trail visualization"""
    accounts = db.execute(text("""
        SELECT fa.id, fa.account_number, fa.bank_name, fa.account_type, fa.flagged,
               s.name as suspect_name, s.risk_level, s.district
        FROM financial_accounts fa
        LEFT JOIN suspects s ON fa.suspect_id = s.id
        WHERE fa.flagged = 1
        LIMIT 60
    """)).fetchall()

    txns = db.execute(text("""
        SELECT ft.from_account, ft.to_account, ft.amount, ft.suspicious
        FROM financial_transactions ft
        WHERE ft.suspicious = 1
        LIMIT 100
    """)).fetchall()

    account_ids = {r[0] for r in accounts}
    nodes = [{
        "id": f"acc_{r[0]}", "label": r[1], "bank": r[2],
        "type": "account", "flagged": bool(r[4]),
        "suspect": r[5], "risk_level": r[6],
        "color": "#ef4444" if r[4] else "#6366f1",
        "val": 12 if r[4] else 8
    } for r in accounts]

    links = [{
        "source": f"acc_{t[0]}", "target": f"acc_{t[1]}",
        "amount": t[2], "suspicious": bool(t[3]),
        "color": "rgba(239,68,68,0.6)" if t[3] else "rgba(99,102,241,0.3)"
    } for t in txns if t[0] in account_ids and t[1] in account_ids]

    return {
        "nodes": nodes,
        "links": links,
        "stats": {
            "flagged_accounts": len(accounts),
            "suspicious_transactions": sum(1 for t in txns if t[3]),
            "total_suspicious_amount": sum(t[2] for t in txns if t[3])
        }
    }


@router.get("/summary")
async def financial_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Overview statistics for the financial crime module"""
    total_accounts = db.execute(text("SELECT COUNT(*) FROM financial_accounts")).scalar() or 0
    flagged_accounts = db.execute(text("SELECT COUNT(*) FROM financial_accounts WHERE flagged=1")).scalar() or 0
    total_txns = db.execute(text("SELECT COUNT(*) FROM financial_transactions")).scalar() or 0
    suspicious_txns = db.execute(text("SELECT COUNT(*) FROM financial_transactions WHERE suspicious=1")).scalar() or 0
    suspicious_amount = db.execute(text("SELECT COALESCE(SUM(amount), 0) FROM financial_transactions WHERE suspicious=1")).scalar() or 0
    return {
        "total_accounts": total_accounts,
        "flagged_accounts": flagged_accounts,
        "total_transactions": total_txns,
        "suspicious_transactions": suspicious_txns,
        "suspicious_amount": round(suspicious_amount, 2)
    }
