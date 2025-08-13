from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas, auth, email_utils
from ..database import get_db
from ..config import settings
import uuid

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="El email ya está registrado"
        )
    
    # Create new user
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.post("/login", response_model=schemas.Token)
def login_user(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user

@router.post("/request-password-reset")
def request_password_reset(request: schemas.PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        # Don't reveal if email exists or not for security
        return {"message": "Si el email existe, recibirás un enlace de recuperación"}
    
    # Generate reset token
    reset_token = auth.generate_reset_token()
    reset_token_expires = auth.create_reset_token_expiry()
    
    # Save token to database
    user.reset_token = reset_token
    user.reset_token_expires = reset_token_expires
    db.commit()
    
    # Send email
    email_sent = email_utils.send_password_reset_email(user.email, reset_token)
    
    if not email_sent:
        raise HTTPException(
            status_code=500,
            detail="Error al enviar el email de recuperación"
        )
    
    return {"message": "Si el email existe, recibirás un enlace de recuperación"}

@router.post("/reset-password")
def reset_password(reset_data: schemas.PasswordReset, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.reset_token == reset_data.token
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Token de recuperación inválido"
        )
    
    # Check if token is expired
    from datetime import datetime
    if user.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Token de recuperación expirado"
        )
    
    # Update password
    user.hashed_password = auth.get_password_hash(reset_data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    
    return {"message": "Contraseña actualizada exitosamente"}

@router.post("/verify-reset-token")
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.reset_token == token
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Token inválido"
        )
    
    # Check if token is expired
    from datetime import datetime
    if user.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Token expirado"
        )
    
    return {"message": "Token válido", "email": user.email}