from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, AuditLog, ChatMessage, ChatSession
from routers.auth import get_current_user
from typing import Optional
import csv, io
from datetime import datetime

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/logs")
async def get_audit_logs(limit: int = 100, offset: int = 0,
                          username: Optional[str] = None,
                          db: Session = Depends(get_db),
                          current_user=Depends(get_current_user)):
    q = db.query(AuditLog)
    if username:
        q = q.filter(AuditLog.username == username)
    total = q.count()
    logs = q.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "logs": [{
            "id": l.id, "username": l.username, "action": l.action,
            "query": l.query, "sql_generated": l.sql_generated,
            "result_count": l.result_count, "ip_address": l.ip_address,
            "timestamp": l.timestamp.isoformat()
        } for l in logs]
    }

@router.get("/export/csv")
async def export_audit_csv(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(1000).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Username", "Action", "Query", "SQL Generated", "Result Count", "IP Address", "Timestamp"])
    for l in logs:
        writer.writerow([l.id, l.username, l.action, l.query, l.sql_generated,
                         l.result_count, l.ip_address, l.timestamp.isoformat()])
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_log_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@router.get("/stats")
async def audit_stats(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    total = db.query(AuditLog).count()
    result = db.execute(text(
        "SELECT username, COUNT(*) as queries FROM audit_logs GROUP BY username ORDER BY queries DESC LIMIT 10"
    ))
    top_users = [{"username": r[0], "queries": r[1]} for r in result.fetchall()]
    return {"total_queries": total, "top_users": top_users}
