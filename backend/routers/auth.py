from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import bcrypt
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_db, User
import os

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "scrb-karnataka-secret-key-2024-datathon")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

ROLE_PERMISSIONS = {
    "super_admin": ["read", "write", "delete", "admin"],
    "district_sp": ["read", "write"],
    "investigator": ["read", "write"],
    "analyst": ["read"],
    "readonly": ["read"],
}

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    district: str
    permissions: list[str]

def verify_password(plain, hashed):
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    token = create_access_token({"sub": user.username, "role": user.role, "district": user.district})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id, "username": user.username, "full_name": user.full_name,
            "role": user.role, "district": user.district,
            "permissions": ROLE_PERMISSIONS.get(user.role, ["read"])
        }
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id, username=current_user.username,
        full_name=current_user.full_name, role=current_user.role,
        district=current_user.district,
        permissions=ROLE_PERMISSIONS.get(current_user.role, ["read"])
    )

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    district: str

@router.get("/users")
async def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "full_name": u.full_name,
             "role": u.role, "district": u.district, "is_active": u.is_active} for u in users]

@router.post("/users")
async def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if user_in.role not in ["super_admin", "district_sp", "investigator", "analyst", "readonly"]:
        raise HTTPException(status_code=400, detail="Invalid role designation")
    
    # Check if user already exists
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = bcrypt.hashpw(user_in.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_user = User(
        username=user_in.username,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
        role=user_in.role,
        district=user_in.district,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully", "username": new_user.username}

@router.post("/users/{user_id}/toggle")
async def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user_to_toggle = db.query(User).filter(User.id == user_id).first()
    if not user_to_toggle:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_to_toggle.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot toggle your own status")
        
    user_to_toggle.is_active = not user_to_toggle.is_active
    db.commit()
    return {"message": f"User status toggled to {user_to_toggle.is_active}", "is_active": user_to_toggle.is_active}

