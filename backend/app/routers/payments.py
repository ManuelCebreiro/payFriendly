from typing import List, Optional

from fastapi import (APIRouter, Depends, File, Form, HTTPException, UploadFile,
                     status)
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from .. import auth, cloudinary_utils, models, schemas
from ..database import get_db

router = APIRouter(prefix="/payments", tags=["payments"])

@router.post("/", response_model=schemas.Payment)
async def create_payment(
    group_id: int = Form(...),
    amount: float = Form(...),
    participant_id: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    receipt: Optional[UploadFile] = File(None),
    auto_verify: Optional[bool] = Form(False),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if user is participant of the group
    participant = db.query(models.Participant).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este grupo"
        )
    
    # Check if group exists and is active
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    receipt_url = None
    if receipt:
        try:
            receipt_url = await cloudinary_utils.upload_receipt_image(
                receipt, current_user.id, group_id
            )
        except HTTPException as e:
            raise e
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail="Error al subir el comprobante"
            )
    
    # Auto-verify payment if it has receipt and participant assigned
    should_verify = auto_verify or (receipt_url and participant_id)
    
    # Create payment
    db_payment = models.Payment(
        user_id=current_user.id,
        participant_id=participant_id or participant.id,
        group_id=group_id,
        amount=amount,
        notes=notes,
        receipt_url=receipt_url,
        is_verified=should_verify
    )
    
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    
    return db_payment

@router.get("/group/{group_id}", response_model=List[schemas.Payment])
def get_group_payments(
    group_id: int,
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if user is participant
    participant = db.query(models.Participant).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este grupo"
        )
    
    payments = db.query(models.Payment).filter(
        models.Payment.group_id == group_id
    ).order_by(desc(models.Payment.payment_date)).offset(skip).limit(limit).all()
    
    return payments

@router.get("/my-payments", response_model=List[schemas.Payment])
def get_my_payments(
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    payments = db.query(models.Payment).filter(
        models.Payment.user_id == current_user.id
    ).order_by(desc(models.Payment.payment_date)).offset(skip).limit(limit).all()
    
    return payments

@router.get("/{payment_id}", response_model=schemas.Payment)
def get_payment(
    payment_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    payment = db.query(models.Payment).filter(
        models.Payment.id == payment_id
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    # Check if user has access (is participant of the group)
    participant = db.query(models.Participant).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.group_id == payment.group_id,
        models.Participant.is_active == True
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este pago"
        )
    
    return payment

@router.put("/{payment_id}", response_model=schemas.Payment)
async def update_payment(
    payment_id: int,
    amount: Optional[float] = Form(None),
    notes: Optional[str] = Form(None),
    receipt: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    # Permissions: owner of the payment or owner of the group
    is_payment_owner = payment.user_id == current_user.id
    is_group_owner = db.query(models.Group).filter(
        models.Group.id == payment.group_id,
        models.Group.owner_id == current_user.id
    ).first() is not None
    if not (is_payment_owner or is_group_owner):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para editar este pago")
    
    # Update fields
    if amount is not None:
        payment.amount = amount
    if notes is not None:
        payment.notes = notes
    
    # Handle receipt update
    if receipt:
        # Delete old receipt if exists
        if payment.receipt_url:
            cloudinary_utils.delete_receipt_image(payment.receipt_url)
        
        try:
            receipt_url = await cloudinary_utils.upload_receipt_image(
                receipt, current_user.id, payment.group_id
            )
            payment.receipt_url = receipt_url
        except HTTPException as e:
            raise e
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail="Error al subir el comprobante"
            )
    
    db.commit()
    db.refresh(payment)
    
    return payment

@router.delete("/{payment_id}")
def delete_payment(
    payment_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    # Permissions: owner of the payment or owner of the group
    is_payment_owner = payment.user_id == current_user.id
    is_group_owner = db.query(models.Group).filter(
        models.Group.id == payment.group_id,
        models.Group.owner_id == current_user.id
    ).first() is not None
    if not (is_payment_owner or is_group_owner):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para eliminar este pago")
    
    # Delete receipt from Cloudinary if exists
    if payment.receipt_url:
        cloudinary_utils.delete_receipt_image(payment.receipt_url)
    
    db.delete(payment)
    db.commit()
    
    return {"message": "Pago eliminado exitosamente"}

@router.post("/{payment_id}/verify")
def verify_payment(
    payment_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    payment = db.query(models.Payment).filter(
        models.Payment.id == payment_id
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    # Check if user is owner of the group
    group = db.query(models.Group).filter(
        models.Group.id == payment.group_id,
        models.Group.owner_id == current_user.id
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el propietario del grupo puede verificar pagos"
        )
    
    payment.is_verified = True
    db.commit()
    
    return {"message": "Pago verificado exitosamente"}

@router.get("/group/{group_id}/stats")
def get_group_payment_stats(
    group_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if user is participant
    participant = db.query(models.Participant).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este grupo"
        )
    
    # Calculate stats
    total_payments = db.query(func.sum(models.Payment.amount)).filter(
        models.Payment.group_id == group_id
    ).scalar() or 0
    
    payment_count = db.query(func.count(models.Payment.id)).filter(
        models.Payment.group_id == group_id
    ).scalar() or 0
    
    verified_payments = db.query(func.count(models.Payment.id)).filter(
        models.Payment.group_id == group_id,
        models.Payment.is_verified == True
    ).scalar() or 0
    
    # Get payment summary by user
    user_payments = db.query(
        models.User.full_name,
        func.sum(models.Payment.amount).label('total_amount'),
        func.count(models.Payment.id).label('payment_count')
    ).join(
        models.Payment
    ).filter(
        models.Payment.group_id == group_id
    ).group_by(
        models.User.id, models.User.full_name
    ).all()
    
    return {
        "total_payments": total_payments,
        "payment_count": payment_count,
        "verified_payments": verified_payments,
        "user_payments": [
            {
                "user_name": up.full_name,
                "total_amount": up.total_amount,
                "payment_count": up.payment_count
            }
            for up in user_payments
        ]
    }