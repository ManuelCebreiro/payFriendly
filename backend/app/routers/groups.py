import secrets
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db

router = APIRouter(prefix="/groups", tags=["groups"])

def generate_public_id():
    return secrets.token_urlsafe(8)

@router.post("/", response_model=schemas.Group)
def create_group(
    group: schemas.GroupCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Generate unique public ID
    public_id = generate_public_id()
    while db.query(models.Group).filter(models.Group.public_id == public_id).first():
        public_id = generate_public_id()
    
    db_group = models.Group(
        **group.dict(),
        owner_id=current_user.id,
        public_id=public_id
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    
    # Add owner as participant
    participant = models.Participant(
        user_id=current_user.id,
        group_id=db_group.id
    )
    db.add(participant)
    db.commit()
    
    return db_group

@router.get("/", response_model=List[schemas.GroupWithStats])
def get_user_groups(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get groups where user is participant
    groups = db.query(models.Group).join(
        models.Participant
    ).filter(
        models.Participant.user_id == current_user.id,
        models.Group.is_active == True,
        models.Participant.is_active == True
    ).all()
    
    result = []
    for group in groups:
        # Calculate stats
        total_participants = db.query(models.Participant).filter(
            models.Participant.group_id == group.id,
            models.Participant.is_active == True
        ).count()
        
        total_payments = db.query(func.sum(models.Payment.amount)).filter(
            models.Payment.group_id == group.id
        ).scalar() or 0
        
        group_with_stats = schemas.GroupWithStats(
            **group.__dict__,
            total_participants=total_participants,
            total_payments=total_payments
        )
        result.append(group_with_stats)
    
    return result

@router.get("/{group_id}", response_model=schemas.GroupWithStats)
def get_group(
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
    
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    # Calculate stats
    total_participants = db.query(models.Participant).filter(
        models.Participant.group_id == group.id,
        models.Participant.is_active == True
    ).count()
    
    total_payments = db.query(func.sum(models.Payment.amount)).filter(
        models.Payment.group_id == group.id
    ).scalar() or 0
    
    return schemas.GroupWithStats(
        **group.__dict__,
        total_participants=total_participants,
        total_payments=total_payments
    )

@router.put("/{group_id}", response_model=schemas.Group)
def update_group(
    group_id: int,
    group_update: schemas.GroupUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.owner_id == current_user.id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado o no tienes permisos para editarlo"
        )
    
    # Update fields
    update_data = group_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)
    
    db.commit()
    db.refresh(group)
    
    return group

@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.owner_id == current_user.id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado o no tienes permisos para eliminarlo"
        )
    
    # Soft delete
    group.is_active = False
    db.commit()
    
    return {"message": "Grupo eliminado exitosamente"}

@router.get("/public/{public_id}", response_model=schemas.PublicGroupView)
def get_public_group(public_id: str, db: Session = Depends(get_db)):
    group = db.query(models.Group).filter(
        models.Group.public_id == public_id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    # Get stats
    total_participants = db.query(models.Participant).filter(
        models.Participant.group_id == group.id,
        models.Participant.is_active == True
    ).count()
    
    # Get recent payments (last 5)
    recent_payments = db.query(models.Payment).filter(
        models.Payment.group_id == group.id
    ).order_by(models.Payment.payment_date.desc()).limit(5).all()
    
    return schemas.PublicGroupView(
        name=group.name,
        description=group.description,
        payment_amount=group.payment_amount,
        payment_frequency=group.payment_frequency,
        total_participants=total_participants,
        recent_payments=recent_payments
    )

@router.post("/{group_id}/join")
def join_group(
    group_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if group exists
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    # Check if already participant
    existing_participant = db.query(models.Participant).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.group_id == group_id
    ).first()
    
    if existing_participant:
        if existing_participant.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya eres participante de este grupo"
            )
        else:
            # Reactivate participation
            existing_participant.is_active = True
            db.commit()
            return {"message": "Te has unido al grupo exitosamente"}
    
    # Create new participation
    participant = models.Participant(
        user_id=current_user.id,
        group_id=group_id
    )
    db.add(participant)
    db.commit()
    
    return {"message": "Te has unido al grupo exitosamente"}

@router.post("/{group_id}/leave")
def leave_group(
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No eres participante de este grupo"
        )
    
    # Check if user is owner
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.owner_id == current_user.id
    ).first()
    
    if group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes abandonar un grupo del cual eres propietario"
        )
    
    # Deactivate participation
    participant.is_active = False
    db.commit()
    
    return {"message": "Has abandonado el grupo exitosamente"}

@router.get("/{group_id}/participants", response_model=List[schemas.Participant])
def get_group_participants(
    group_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if user is participant
    user_participant = db.query(models.Participant).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).first()
    
    if not user_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este grupo"
        )
    
    participants = db.query(models.Participant).filter(
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).all()
    
    return participants

@router.post("/{group_id}/add-guest", response_model=schemas.Participant)
def add_guest_participant(
    group_id: int,
    guest_data: schemas.GuestParticipantCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if user is owner or participant of the group
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    # Check if user is owner or participant
    user_participant = db.query(models.Participant).filter(
        models.Participant.user_id == current_user.id,
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).first()
    
    is_owner = group.owner_id == current_user.id
    
    if not (is_owner or user_participant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para añadir miembros a este grupo"
        )
    
    # Check if guest name already exists in this group
    existing_guest = db.query(models.Participant).filter(
        models.Participant.group_id == group_id,
        models.Participant.guest_name == guest_data.guest_name,
        models.Participant.is_active == True
    ).first()
    
    if existing_guest:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un miembro con ese nombre en el grupo"
        )
    
    # Create guest participant
    guest_participant = models.Participant(
        group_id=group_id,
        guest_name=guest_data.guest_name,
        guest_email=guest_data.guest_email
    )
    
    db.add(guest_participant)
    db.commit()
    db.refresh(guest_participant)
    
    return guest_participant

@router.post("/{group_id}/link-guest/{participant_id}")
def link_guest_to_user(
    group_id: int,
    participant_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db),
    # Optional user_id to link if requester is the owner
    user_id: int | None = None,
):
    # Check if group exists
    group = db.query(models.Group).filter(
        models.Group.id == group_id,
        models.Group.is_active == True
    ).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado"
        )
    
    # Check if participant exists and is a guest (no user_id)
    guest_participant = db.query(models.Participant).filter(
        models.Participant.id == participant_id,
        models.Participant.group_id == group_id,
        models.Participant.user_id.is_(None),
        models.Participant.is_active == True
    ).first()
    
    if not guest_participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participante invitado no encontrado"
        )
    
    # Determine target user to link
    target_user_id = current_user.id
    if user_id is not None:
        # Only group owner can link a guest to another user
        if group.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario del grupo puede vincular a otros usuarios"
            )
        # Validate target user exists
        target_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario objetivo no encontrado")
        target_user_id = user_id

    # Check if target user already participates in the group
    existing_user_participant = db.query(models.Participant).filter(
        models.Participant.user_id == target_user_id,
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).first()
    if existing_user_participant:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El usuario ya es participante de este grupo")

    # Link guest to target user
    guest_participant.user_id = target_user_id
    db.commit()
    
    return {"message": f"Participante vinculado exitosamente como {guest_participant.guest_name} en el grupo {group.name}"}

@router.put("/{group_id}/participants/{participant_id}", response_model=schemas.Participant)
def update_participant(
    group_id: int,
    participant_id: int,
    participant_update: schemas.ParticipantUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Only group owner can update participant details
    group = db.query(models.Group).filter(models.Group.id == group_id, models.Group.is_active == True).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado")
    if group.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para editar participantes")

    participant = db.query(models.Participant).filter(
        models.Participant.id == participant_id,
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).first()
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participante no encontrado")

    update_data = participant_update.dict(exclude_unset=True)
    if participant.user_id is not None:
        # Do not allow editing guest fields for registered users
        update_data.pop("guest_name", None)
        update_data.pop("guest_email", None)
    for field, value in update_data.items():
        setattr(participant, field, value)
    db.commit()
    db.refresh(participant)
    return participant

@router.delete("/{group_id}/participants/{participant_id}")
def remove_participant(
    group_id: int,
    participant_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Only group owner can remove participants
    group = db.query(models.Group).filter(models.Group.id == group_id, models.Group.is_active == True).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado")
    if group.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para eliminar participantes")

    participant = db.query(models.Participant).filter(
        models.Participant.id == participant_id,
        models.Participant.group_id == group_id,
        models.Participant.is_active == True
    ).first()
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participante no encontrado")

    participant.is_active = False
    db.commit()
    return {"message": "Participante eliminado exitosamente"}