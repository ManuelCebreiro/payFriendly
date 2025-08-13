from datetime import date, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get total groups where user is participant
    total_groups = db.query(func.count(models.Group.id)).join(
        models.Participant
    ).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.is_active == True,
        models.Group.is_active == True
    ).scalar() or 0
    
    # Get total payments made by user
    total_payments = db.query(func.sum(models.Payment.amount)).filter(
        models.Payment.user_id == current_user.id
    ).scalar() or 0
    
    # Get pending payments (groups where user hasn't paid in the current period)
    user_groups = db.query(models.Group).join(
        models.Participant
    ).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.is_active == True,
        models.Group.is_active == True
    ).all()
    
    pending_payments = 0
    now = datetime.utcnow()
    
    for group in user_groups:
        # Calculate current period bounds for this group
        current_start, current_end = _current_period_bounds(group.payment_frequency, now)
        
        # Check if user has made a payment in the current period
        recent_payment = db.query(models.Payment).filter(
            models.Payment.user_id == current_user.id,
            models.Payment.group_id == group.id,
            models.Payment.payment_date >= current_start,
            models.Payment.payment_date <= current_end
        ).first()
        
        if not recent_payment:
            pending_payments += 1
    
    # Get recent payments (last 10)
    recent_payments = db.query(models.Payment).filter(
        models.Payment.user_id == current_user.id
    ).order_by(desc(models.Payment.payment_date)).limit(10).all()
    
    return schemas.DashboardStats(
        total_groups=total_groups,
        total_payments=total_payments,
        pending_payments=pending_payments,
        recent_payments=recent_payments
    )

@router.get("/recent-activity")
def get_recent_activity(
    limit: int = 20,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get recent payments from all groups user participates in
    recent_payments = db.query(models.Payment).join(
        models.Group
    ).join(
        models.Participant,
        models.Participant.group_id == models.Group.id
    ).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.is_active == True
    ).order_by(desc(models.Payment.payment_date)).limit(limit).all()
    
    activity = []
    for payment in recent_payments:
        activity.append({
            "type": "payment",
            "id": payment.id,
            "user_name": payment.user.full_name,
            "group_name": payment.group.name,
            "amount": payment.amount,
            "date": payment.payment_date,
            "is_own_payment": payment.user_id == current_user.id
        })
    
    return {"activity": activity}

@router.get("/payment-summary")
def get_payment_summary(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get payment summary by group
    group_summaries = db.query(
        models.Group.name,
        models.Group.id,
        models.Group.payment_amount,
        models.Group.payment_frequency,
        func.sum(models.Payment.amount).label('total_paid'),
        func.count(models.Payment.id).label('payment_count'),
        func.max(models.Payment.payment_date).label('last_payment')
    ).join(
        models.Payment
    ).join(
        models.Participant,
        models.Participant.group_id == models.Group.id
    ).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.is_active == True,
        models.Payment.user_id == current_user.id
    ).group_by(
        models.Group.id, models.Group.name, models.Group.payment_amount, models.Group.payment_frequency
    ).all()
    
    summaries = []
    for summary in group_summaries:
        # Calculate if payment is due based on frequency
        days_since_last = 0
        if summary.last_payment:
            days_since_last = (datetime.utcnow() - summary.last_payment).days
        
        is_due = False
        if summary.payment_frequency == 'weekly' and days_since_last > 7:
            is_due = True
        elif summary.payment_frequency == 'monthly' and days_since_last > 30:
            is_due = True
        elif summary.payment_frequency == 'biweekly' and days_since_last > 14:
            is_due = True
        
        summaries.append({
            "group_name": summary.name,
            "group_id": summary.id,
            "expected_amount": summary.payment_amount,
            "payment_frequency": summary.payment_frequency,
            "total_paid": summary.total_paid or 0,
            "payment_count": summary.payment_count or 0,
            "last_payment": summary.last_payment,
            "days_since_last": days_since_last,
            "is_due": is_due
        })
    
    return {"group_summaries": summaries}

@router.get("/notifications", response_model=List[schemas.Notification])
async def get_notifications(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user notifications"""
    notifications = []
    
    # Get user's groups
    user_groups = db.query(models.Group).join(
        models.Participant, models.Group.id == models.Participant.group_id
    ).filter(
        models.Participant.user_id == current_user.id,
        models.Group.is_active == True
    ).all()
    
    for group in user_groups:
        # Calculate days until next payment based on frequency
        frequency_days = {
            "weekly": 7,
            "monthly": 30,
            "quarterly": 90,
            "yearly": 365
        }.get(group.payment_frequency, 30)
        
        # Get the last payment date for this group
        last_payment = db.query(models.Payment).filter(
            models.Payment.group_id == group.id
        ).order_by(models.Payment.payment_date.desc()).first()
        
        if last_payment:
            days_since_last = (datetime.now().date() - last_payment.payment_date.date()).days
            days_until_next = frequency_days - days_since_last
            
            # Notification for upcoming payment deadline (2 days before)
            if 0 <= days_until_next <= 2:
                notifications.append({
                    "id": f"deadline_{group.id}",
                    "type": "warning",
                    "title": "Pago próximo a vencer",
                    "message": f"Quedan {days_until_next} días para el próximo pago en {group.name}",
                    "group_id": group.id,
                    "priority": "high",
                    "created_at": datetime.now(),
                    "is_read": False
                })
        
        # Get users who haven't paid in a long time (more than 2 payment cycles)
        overdue_threshold = frequency_days * 2
        
        # Get all participants in the group
        participants = db.query(models.Participant).join(
            models.User, models.Participant.user_id == models.User.id
        ).filter(
            models.Participant.group_id == group.id
        ).all()
        
        overdue_users = []
        for participant in participants:
            # Get user's last payment in this group
            user_last_payment = db.query(models.Payment).filter(
                models.Payment.group_id == group.id,
                models.Payment.user_id == participant.user_id
            ).order_by(models.Payment.payment_date.desc()).first()
            
            if user_last_payment:
                days_since_payment = (datetime.now().date() - user_last_payment.payment_date.date()).days
                if days_since_payment > overdue_threshold:
                    overdue_users.append({
                        "name": participant.user.full_name,
                        "days": days_since_payment
                    })
            else:
                # User has never paid
                overdue_users.append({
                    "name": participant.user.full_name,
                    "days": 999
                })
        
        # Sort by days overdue and take the top 4
        overdue_users.sort(key=lambda x: x["days"], reverse=True)
        top_overdue = overdue_users[:4]
        
        if top_overdue:
            user_names = ", ".join([user["name"] for user in top_overdue])
            notifications.append({
                "id": f"overdue_{group.id}",
                "type": "danger",
                "title": "Usuarios con pagos atrasados",
                "message": f"En {group.name}: {user_names} tienen pagos pendientes desde hace tiempo",
                "group_id": group.id,
                "priority": "high",
                "created_at": datetime.now(),
                "is_read": False
            })
    
    return notifications

@router.get("/group-summaries")
def get_group_summaries(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get group summaries for dashboard"""
    return get_payment_summary(current_user, db)

@router.get("/overdue-participants")
def get_overdue_participants(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get participants with overdue payments"""
    overdue_participants = []
    
    # Get user's groups
    user_groups = db.query(models.Group).join(
        models.Participant, models.Group.id == models.Participant.group_id
    ).filter(
        models.Participant.user_id == current_user.id,
        models.Group.is_active == True
    ).all()
    
    for group in user_groups:
        frequency_days = {
            "weekly": 7,
            "monthly": 30,
            "quarterly": 90,
            "yearly": 365
        }.get(group.payment_frequency, 30)
        
        overdue_threshold = frequency_days * 1.5  # 1.5 payment cycles
        
        # Get all participants in the group
        participants = db.query(models.Participant).filter(
            models.Participant.group_id == group.id,
            models.Participant.is_active == True
        ).all()
        
        for participant in participants:
            # Handle both registered users and guests
            participant_name = ""
            if participant.user_id:
                participant_name = participant.user.full_name
            else:
                participant_name = participant.guest_name or "Invitado"
            
            # Get participant's last payment in this group
            last_payment = db.query(models.Payment).filter(
                models.Payment.group_id == group.id,
                models.Payment.participant_id == participant.id
            ).order_by(models.Payment.payment_date.desc()).first()
            
            if last_payment:
                days_since_payment = (datetime.now().date() - last_payment.payment_date.date()).days
                if days_since_payment > overdue_threshold:
                    overdue_participants.append({
                        "name": participant_name,
                        "group_name": group.name,
                        "group_id": group.id,
                        "participant_id": participant.id,
                        "days_overdue": days_since_payment,
                        "amount_due": group.payment_amount,
                        "last_payment_date": last_payment.payment_date
                    })
            else:
                # Participant has never paid - check how long they've been in the group
                days_since_joined = (datetime.now().date() - participant.joined_at.date()).days
                if days_since_joined > frequency_days:
                    overdue_participants.append({
                        "name": participant_name,
                        "group_name": group.name,
                        "group_id": group.id,
                        "participant_id": participant.id,
                        "days_overdue": days_since_joined,
                        "amount_due": group.payment_amount,
                        "last_payment_date": participant.joined_at.date()
                    })
    
    # Sort by days overdue (most overdue first) and limit to top 10
    overdue_participants.sort(key=lambda x: x["days_overdue"], reverse=True)
    return {"overdue_participants": overdue_participants[:10]}

# Helpers to compute period windows based on payment frequency
def _frequency_days(payment_frequency: str) -> int:
    return {
        "weekly": 7,
        "biweekly": 14,
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
    }.get(payment_frequency, 30)

def _current_period_bounds(payment_frequency: str, reference_dt: datetime):
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

def _previous_period_bounds(payment_frequency: str, reference_dt: datetime):
    current_start, current_end = _current_period_bounds(payment_frequency, reference_dt)
    if payment_frequency == "weekly":
        prev_start = current_start - timedelta(days=7)
        prev_end = current_end - timedelta(days=7)
    elif payment_frequency == "biweekly":
        prev_start = current_start - timedelta(days=14)
        prev_end = current_end - timedelta(days=14)
    elif payment_frequency == "monthly":
        prev_month_end = current_start - timedelta(seconds=1)
        prev_start = prev_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_end = prev_month_end.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif payment_frequency == "quarterly":
        prev_end = current_start - timedelta(seconds=1)
        prev_q_month = ((prev_end.month - 1) // 3) * 3 + 1
        prev_start_date = date(prev_end.year, prev_q_month, 1)
        prev_start = datetime.combine(prev_start_date, datetime.min.time())
    elif payment_frequency == "yearly":
        prev_start = datetime(current_start.year - 1, 1, 1)
        prev_end = datetime(current_start.year - 1, 12, 31, 23, 59, 59, 999999)
    else:
        prev_month_end = current_start - timedelta(seconds=1)
        prev_start = prev_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_end = prev_month_end.replace(hour=23, minute=59, second=59, microsecond=999999)
    return prev_start, prev_end

@router.get("/next-payers")
def get_next_payers(
    limit: int = 4,
    group_id: int = None,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Participantes ordenados por más tiempo desde su último pago verificado.
    Si se especifica group_id, se limita al grupo.
    """
    groups_query = db.query(models.Group).join(
        models.Participant, models.Group.id == models.Participant.group_id
    ).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.is_active == True,
        models.Group.is_active == True
    )
    if group_id is not None:
        groups_query = groups_query.filter(models.Group.id == group_id)
    groups = groups_query.all()

    ranking = []
    now = datetime.utcnow()
    for grp in groups:
        participants = db.query(models.Participant).filter(
            models.Participant.group_id == grp.id,
            models.Participant.is_active == True
        ).all()
        for participant in participants:
            if participant.user_id and participant.user:
                name = participant.user.full_name
            else:
                name = participant.guest_name or "Invitado"
            last_payment = db.query(models.Payment).filter(
                models.Payment.group_id == grp.id,
                models.Payment.participant_id == participant.id,
                models.Payment.is_verified == True
            ).order_by(models.Payment.payment_date.desc()).first()
            if last_payment:
                days_since = (now.date() - last_payment.payment_date.date()).days
                last_date = last_payment.payment_date
            else:
                days_since = (now.date() - participant.joined_at.date()).days
                last_date = None
            ranking.append({
                "name": name,
                "group_name": grp.name,
                "group_id": grp.id,
                "participant_id": participant.id,
                "days_since_last": days_since,
                "last_payment_date": last_date,
                "amount_due": grp.payment_amount,
            })

    ranking.sort(key=lambda x: x["days_since_last"], reverse=True)
    return {"next_payers": ranking[: max(0, limit)]}

@router.get("/last-payers")
def get_last_payers(
    limit: int = 10,
    group_id: int = None,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Pagadores del periodo anterior (pagos verificados), ordenados desc por fecha.
    Si se especifica group_id, se limita al grupo.
    """
    groups_query = db.query(models.Group).join(
        models.Participant, models.Group.id == models.Participant.group_id
    ).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.is_active == True,
        models.Group.is_active == True
    )
    if group_id is not None:
        groups_query = groups_query.filter(models.Group.id == group_id)
    groups = groups_query.all()

    items = []
    now = datetime.utcnow()
    for grp in groups:
        prev_start, prev_end = _previous_period_bounds(grp.payment_frequency, now)
        payments = db.query(models.Payment).filter(
            models.Payment.group_id == grp.id,
            models.Payment.payment_date >= prev_start,
            models.Payment.payment_date <= prev_end,
        ).order_by(desc(models.Payment.payment_date)).all()
        for p in payments:
            display_name = None
            if p.participant_id:
                participant = db.query(models.Participant).filter(models.Participant.id == p.participant_id).first()
                if participant:
                    display_name = participant.guest_name or (participant.user.full_name if participant.user else None)
            if not display_name and p.user:
                display_name = p.user.full_name
            items.append({
                "name": display_name or "Participante",
                "group_name": grp.name,
                "group_id": grp.id,
                "participant_id": p.participant_id,
                "amount": p.amount,
                "payment_date": p.payment_date,
            })

    items.sort(key=lambda x: x["payment_date"], reverse=True)
    return {"last_payers": items[: max(0, limit)]}

@router.get("/groups/{group_id}")
def get_group_detail(
    group_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific group"""
    # Verify user is participant in the group
    participant = db.query(models.Participant).filter(
        models.Participant.group_id == group_id,
        models.Participant.user_id == current_user.id,
        models.Participant.is_active == True
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este grupo"
        )
    
    # Get group information
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    # Get all participants
    participants = db.query(models.Participant).filter(
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).all()
    
    # Calculate current period bounds
    now = datetime.utcnow()
    current_start, current_end = _current_period_bounds(group.payment_frequency, now)
    
    # Get all payments for this group (for display)
    payments = db.query(models.Payment).filter(
        models.Payment.group_id == group_id
    ).order_by(models.Payment.payment_date.desc()).all()
    
    # Calculate group statistics for CURRENT PERIOD only
    current_period_collected = db.query(func.sum(models.Payment.amount)).filter(
        models.Payment.group_id == group_id,
        models.Payment.payment_date >= current_start,
        models.Payment.payment_date <= current_end
    ).scalar() or 0
    
    # Calculate total historical collected (for reference)
    total_collected = db.query(func.sum(models.Payment.amount)).filter(
        models.Payment.group_id == group_id
    ).scalar() or 0
    
    # Expected amount for current period
    expected_current_period = len(participants) * group.payment_amount
    # Pending amount is what's missing for the current period
    pending_amount = expected_current_period - current_period_collected
    
    return {
        "group": group,
        "participants": participants,
        "payments": payments,
        "stats": {
            "total_collected": total_collected,
            "current_period_collected": current_period_collected,
            "expected_current_period": expected_current_period,
            "pending_amount": pending_amount,
            "participant_count": len(participants),
            "payment_count": len(payments)
        }
    }

@router.get("/groups/{group_id}/stats")
def get_group_specific_stats(
    group_id: int,
    period_date: str = None,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get detailed statistics for a specific group organized by payment periods"""
    # Verify user is participant in the group
    participant = db.query(models.Participant).filter(
        models.Participant.group_id == group_id,
        models.Participant.user_id == current_user.id,
        models.Participant.is_active == True
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este grupo"
        )
    
    # Get group information
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    # Calculate current and previous period bounds
    if period_date:
        try:
            reference_date = datetime.fromisoformat(period_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de fecha inválido. Use formato ISO 8601"
            )
    else:
        reference_date = datetime.utcnow()
    
    current_start, current_end = _current_period_bounds(group.payment_frequency, reference_date)
    previous_start, previous_end = _previous_period_bounds(group.payment_frequency, reference_date)
    
    # Get all participants
    participants = db.query(models.Participant).filter(
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).all()
    
    # Get payments for current period (ALL payments, not just pending)
    current_period_payments = db.query(models.Payment).filter(
        models.Payment.group_id == group_id,
        models.Payment.payment_date >= current_start,
        models.Payment.payment_date <= current_end
    ).order_by(models.Payment.payment_date.desc()).all()
    
    # Get payments for previous period
    previous_period_payments = db.query(models.Payment).filter(
        models.Payment.group_id == group_id,
        models.Payment.payment_date >= previous_start,
        models.Payment.payment_date <= previous_end
    ).order_by(models.Payment.payment_date.desc()).all()
    
    # Calculate payments for current period
    # Count verified payments only
    verified_payments = [p for p in current_period_payments if p.is_verified]
    
    # Calculate amounts
    expected_participants = len(participants)
    # payment_amount is the total amount the group must pay for this period
    expected_amount = group.payment_amount
    
    # Calculate collected amount for current period (sum verified payments only)
    current_collected = sum(p.amount for p in verified_payments)
    
    # Pending amount is what's left to reach the group's payment_amount
    current_pending = max(0, expected_amount - current_collected)
    
    # Format current period payments for display
    formatted_current_payments = []
    for payment in current_period_payments:
        display_name = None
        if payment.participant_id:
            participant = db.query(models.Participant).filter(
                models.Participant.id == payment.participant_id
            ).first()
            if participant:
                display_name = participant.guest_name or (participant.user.full_name if participant.user else None)
        if not display_name and payment.user:
            display_name = payment.user.full_name
            
        formatted_current_payments.append({
            "id": payment.id,
            "user_name": display_name or "Participante",
            "amount": payment.amount,
            "payment_date": payment.payment_date,
            "notes": payment.notes,
            "is_verified": payment.is_verified,
            "receipt_url": payment.receipt_url,
            "user_id": payment.user_id,
            "participant_id": payment.participant_id
        })
    
    # Format previous period payments for display
    formatted_previous_payments = []
    for payment in previous_period_payments:
        display_name = None
        if payment.participant_id:
            participant = db.query(models.Participant).filter(
                models.Participant.id == payment.participant_id
            ).first()
            if participant:
                display_name = participant.guest_name or (participant.user.full_name if participant.user else None)
        if not display_name and payment.user:
            display_name = payment.user.full_name
            
        formatted_previous_payments.append({
            "id": payment.id,
            "name": display_name or "Participante",
            "amount": payment.amount,
            "payment_date": payment.payment_date,
            "group_name": group.name
        })
    
    return {
        "group_id": group.id,
        "group_name": group.name,
        "payment_amount": group.payment_amount,
        "payment_frequency": group.payment_frequency,
        "frequency_display": {
            "weekly": "Semanal",
            "monthly": "Mensual", 
            "quarterly": "Trimestral",
            "yearly": "Anual"
        }.get(group.payment_frequency, group.payment_frequency),
        "current_period": {
            "start": current_start,
            "end": current_end,
            "expected_participants": expected_participants,
            "expected_amount": expected_amount,
            "collected_amount": current_collected,
            "pending_amount": current_pending,
            "payments": formatted_current_payments
        },
        "previous_period": {
            "start": previous_start,
            "end": previous_end,
            "payments": formatted_previous_payments
        },
        "total_participants": len(participants)
    }

def _navigate_period(payment_frequency: str, reference_dt: datetime, direction: str):
    """Navigate to next or previous period based on payment frequency"""
    if direction == "next":
        if payment_frequency == "weekly":
            return reference_dt

@router.post("/reassign-payer/{group_id}")
def reassign_payer(
    group_id: int,
    skip_participant_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Saltar un participante y obtener el siguiente en la lista de próximos aportadores.
    Esto permite reasignar manualmente quién debe aportar cuando alguien no puede hacerlo.
    """
    # Verificar que el usuario tenga acceso al grupo
    participant = db.query(models.Participant).filter(
        models.Participant.group_id == group_id,
        models.Participant.user_id == current_user.id,
        models.Participant.is_active == True
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este grupo"
        )
    
    # Obtener el grupo
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    # Verificar que el participante a saltar existe en el grupo
    skip_participant = db.query(models.Participant).filter(
        models.Participant.id == skip_participant_id,
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).first()
    
    if not skip_participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participante no encontrado en este grupo"
        )
    
    # Obtener todos los participantes del grupo ordenados por tiempo sin aportar
    participants = db.query(models.Participant).filter(
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).all()
    
    ranking = []
    now = datetime.utcnow()
    
    for p in participants:
        if p.user_id and p.user:
            name = p.user.full_name
        else:
            name = p.guest_name or "Invitado"
        
        # Buscar el último pago verificado
        last_payment = db.query(models.Payment).filter(
            models.Payment.group_id == group_id,
            models.Payment.participant_id == p.id,
            models.Payment.is_verified == True
        ).order_by(models.Payment.payment_date.desc()).first()
        
        if last_payment:
            days_since = (now.date() - last_payment.payment_date.date()).days
            last_date = last_payment.payment_date
        else:
            days_since = (now.date() - p.joined_at.date()).days
            last_date = None
        
        ranking.append({
            "name": name,
            "group_name": group.name,
            "group_id": group.id,
            "participant_id": p.id,
            "days_since_last": days_since,
            "last_payment_date": last_date,
            "amount_due": group.payment_amount,
        })
    
    # Ordenar por días sin aportar (descendente)
    ranking.sort(key=lambda x: x["days_since_last"], reverse=True)
    
    # Encontrar el participante a saltar
    skipped_participant = None
    skipped_index = -1
    
    for i, p in enumerate(ranking):
        if p["participant_id"] == skip_participant_id:
            skipped_participant = p
            skipped_index = i
            break
    
    if not skipped_participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participante no encontrado en la lista de próximos aportadores"
        )
    
    # Remover el participante saltado del ranking
    updated_ranking = [p for p in ranking if p["participant_id"] != skip_participant_id]
    
    # Determinar el siguiente participante después del salto
    next_participant = None
    if updated_ranking:
        # Si había participantes después del saltado, el siguiente es el que estaba en esa posición
        if skipped_index < len(updated_ranking):
            next_participant = updated_ranking[skipped_index]
        else:
            # Si era el último, el siguiente es el primero de la lista actualizada
            next_participant = updated_ranking[0]
    
    # Agregar el participante saltado al final de la lista (para futuras rondas)
    updated_ranking.append(skipped_participant)
    
    return {
        "message": f"Participante {skipped_participant['name']} saltado exitosamente",
        "skipped_participant": skipped_participant,
        "next_participant": next_participant,
        "updated_ranking": updated_ranking
    }