import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["public"])

@router.get("/test")
async def test_public_endpoint():
    """Endpoint de prueba para verificar que el router público funciona"""
    return {"message": "Router público funcionando correctamente"}

# Helper functions for period calculations (copied from dashboard.py)
def _current_period_bounds(payment_frequency: str, reference_dt: datetime):
    from datetime import date, timedelta
    ref_date = reference_dt.date()
    if payment_frequency == "weekly":
        # Monday-start week
        start = ref_date - timedelta(days=ref_date.weekday())
        end = start + timedelta(days=6)
    elif payment_frequency == "biweekly":
        week_start = ref_date - timedelta(days=ref_date.weekday())
        isoweek = int(week_start.strftime('%V'))
        if isoweek % 2 == 0:
            start = week_start
        else:
            start = week_start - timedelta(days=7)
        end = start + timedelta(days=13)
    elif payment_frequency == "monthly":
        start = ref_date.replace(day=1)
        if start.month == 12:
            next_month_first = date(start.year + 1, 1, 1)
        else:
            next_month_first = date(start.year, start.month + 1, 1)
        end = next_month_first - timedelta(days=1)
    elif payment_frequency == "quarterly":
        quarter = (ref_date.month - 1) // 3
        start = date(ref_date.year, quarter * 3 + 1, 1)
        if quarter == 3:
            next_q_start = date(ref_date.year + 1, 1, 1)
        else:
            next_q_start = date(ref_date.year, (quarter + 1) * 3 + 1, 1)
        end = next_q_start - timedelta(days=1)
    elif payment_frequency == "yearly":
        start = date(ref_date.year, 1, 1)
        end = date(ref_date.year, 12, 31)
    else:
        start = ref_date.replace(day=1)
        if start.month == 12:
            next_month_first = date(start.year + 1, 1, 1)
        else:
            next_month_first = date(start.year, start.month + 1, 1)
        end = next_month_first - timedelta(days=1)
    return datetime.combine(start, datetime.min.time()), datetime.combine(end, datetime.max.time())

@router.get("/overdue/{public_id}")
async def get_public_overdue_participants(
    public_id: str,
    db: Session = Depends(get_db)
):
    """Obtener participantes pendientes de un grupo (endpoint público)"""
    
    logger.info(f"Accediendo a endpoint público para grupo con public_id: {public_id}")
    
    # Verificar que el grupo existe usando public_id
    group = db.query(models.Group).filter(
        models.Group.public_id == public_id
    ).first()
    
    logger.info(f"Grupo encontrado: {group.name if group else 'No encontrado'}")
    logger.info(f"Grupo is_active: {group.is_active if group else 'N/A'}")
    
    if not group:
        logger.error(f"Grupo no encontrado con public_id: {public_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    # Obtener participantes del grupo (sin filtrar por is_active por ahora)
    participants = db.query(models.Participant).filter(
        models.Participant.group_id == group.id
    ).all()
    
    logger.info(f"Participantes encontrados: {len(participants)}")
    
    # Calcular la cantidad pendiente real del grupo usando la misma lógica que el dashboard
    now = datetime.utcnow()
    current_start, current_end = _current_period_bounds(group.payment_frequency, now)
    
    # Obtener pagos verificados del período actual
    verified_payments = db.query(models.Payment).filter(
        models.Payment.group_id == group.id,
        models.Payment.payment_date >= current_start,
        models.Payment.payment_date <= current_end,
        models.Payment.is_verified == True
    ).all()
    
    # Calcular cantidad recaudada y pendiente
    current_collected = sum(p.amount for p in verified_payments)
    expected_amount = group.payment_amount
    pending_amount = max(0, expected_amount - current_collected)
    
    overdue_participants = []
    
    for participant in participants:
        logger.info(f"Procesando participante: {participant.id}, is_active: {participant.is_active}")
        # Obtener el último pago verificado del participante
        last_payment = db.query(models.Payment).filter(
            models.Payment.participant_id == participant.id,
            models.Payment.is_verified == True
        ).order_by(desc(models.Payment.payment_date)).first()
        
        # Calcular días desde el último pago
        if last_payment:
            days_since_last = (datetime.utcnow() - last_payment.payment_date.replace(tzinfo=None)).days
        else:
            # Si nunca ha pagado, usar la fecha de creación del grupo
            days_since_last = (datetime.utcnow() - group.created_at.replace(tzinfo=None)).days
        
        # Obtener nombre del participante
        participant_name = participant.user.full_name if participant.user else participant.guest_name
        
        overdue_participants.append({
            "name": participant_name,
            "days_since_last": days_since_last,
            "last_payment_date": last_payment.payment_date.isoformat() if last_payment else None,
            "group_name": group.name,
            "payment_frequency": group.payment_frequency
        })
    
    # Ordenar por días desde último pago (descendente)
    overdue_participants.sort(key=lambda x: x["days_since_last"], reverse=True)
    
    return {
        "group_info": {
            "name": group.name,
            "description": group.description,
            "payment_amount": group.payment_amount,
            "payment_frequency": group.payment_frequency,
            "total_participants": len(participants),
            "current_period_collected": current_collected,
            "pending_amount": pending_amount
        },
        "overdue_participants": overdue_participants
    }
