from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, ChatSession, ChatMessage, AuditLog, User
from routers.auth import get_current_user
from services.llm_service import get_gemini_response
from datetime import datetime
from typing import Optional, List

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None
    language: Optional[str] = "en"

class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    sql_query: Optional[str]
    timestamp: str
    language: str

@router.post("/message")
async def send_message(req: ChatRequest, request: Request,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    # Validate message content
    if not req.message or not req.message.strip():
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Get or create session
    if req.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == req.session_id,
                                               ChatSession.user_id == current_user.id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(user_id=current_user.id,
                              title=req.message[:50] + "..." if len(req.message) > 50 else req.message)
        db.add(session)
        db.commit()
        db.refresh(session)

    # Build history for context
    history_msgs = db.query(ChatMessage).filter(ChatMessage.session_id == session.id)\
                     .order_by(ChatMessage.timestamp.desc()).limit(10).all()
    history = [{"role": m.role, "content": m.content} for m in reversed(history_msgs)]

    # Save user message
    user_msg = ChatMessage(session_id=session.id, role="user",
                           content=req.message, language=req.language or "en")
    db.add(user_msg)
    db.commit()

    # Get AI response — pass explicit language so it's honoured even when user
    # types English text but has Kannada mode selected via the toggle
    response = await get_gemini_response(req.message, history, db, req.language or "en")

    # Save assistant message
    ai_msg = ChatMessage(session_id=session.id, role="assistant",
                         content=response["answer"],
                         sql_query=response.get("sql", ""),
                         language=response.get("language", "en"))
    db.add(ai_msg)

    # Log to audit trail
    audit = AuditLog(
        user_id=current_user.id, username=current_user.username,
        action="CHAT_QUERY", query=req.message,
        sql_generated=response.get("sql", ""),
        result_count=response.get("result_count", 0),
        ip_address=request.client.host if request.client else "unknown"
    )
    db.add(audit)
    db.commit()
    db.refresh(ai_msg)

    return {
        "session_id": session.id,
        "message_id": ai_msg.id,
        "answer": response["answer"],
        "sql_query": response.get("sql", ""),
        "insights": response.get("insights", []),
        "result_count": response.get("result_count", 0),
        "language": response.get("language", "en"),
        "timestamp": ai_msg.timestamp.isoformat(),
    }

@router.get("/sessions")
async def get_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id)\
                  .order_by(ChatSession.created_at.desc()).limit(20).all()
    return [{"id": s.id, "title": s.title,
             "created_at": s.created_at.isoformat(),
             "message_count": len(s.messages)} for s in sessions]

@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: int, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id,
                                           ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id)\
                  .order_by(ChatMessage.timestamp.asc()).all()
    return {
        "session": {"id": session.id, "title": session.title},
        "messages": [{
            "id": m.id, "role": m.role, "content": m.content,
            "sql_query": m.sql_query, "language": m.language,
            "timestamp": m.timestamp.isoformat()
        } for m in messages]
    }

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id,
                                           ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}

@router.get("/suggested-queries")
async def suggested_queries():
    return {
        "en": [
            "Show me top 5 crime districts in Karnataka",
            "What are the crime trends from 2018 to 2024?",
            "Which police stations have the highest solve rate?",
            "Show cybercrime cases in Bengaluru Urban",
            "Predict crime hotspots for next month",
            "Which districts have the most pending investigations?",
            "Compare murder cases between Mysuru and Bengaluru",
            "Show drug offense trends year by year",
        ],
        "kn": [
            "ಕರ್ನಾಟಕದಲ್ಲಿ ಅತ್ಯಧಿಕ ಅಪರಾಧ ಜಿಲ್ಲೆಗಳು ಯಾವುವು?",
            "ಬೆಂಗಳೂರಿನಲ್ಲಿ ಕಳ್ಳತನ ಪ್ರಕರಣಗಳ ಮಾಹಿತಿ ನೀಡಿ",
            "2023ರಲ್ಲಿ ಅತ್ಯಧಿಕ ಕೊಲೆ ಪ್ರಕರಣಗಳು ಎಲ್ಲಿ ದಾಖಲಾಗಿವೆ?",
            "ಮಹಿಳೆಯರ ವಿರುದ್ಧ ಅಪರಾಧಗಳ ಅಂಕಿಅಂಶ ತೋರಿಸಿ",
        ]
    }
