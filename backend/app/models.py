from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import uuid

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    owned_groups = relationship("Group", back_populates="owner")
    participations = relationship("Participant", back_populates="user")
    payments = relationship("Payment", back_populates="user")

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    payment_amount = Column(Float, nullable=False)
    payment_frequency = Column(String, nullable=False)  # weekly, monthly, etc.
    public_id = Column(String, unique=True, index=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    owner = relationship("User", back_populates="owned_groups")
    participants = relationship("Participant", back_populates="group")
    payments = relationship("Payment", back_populates="group")

class Participant(Base):
    __tablename__ = "participants"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Opcional para miembros no registrados
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    # Campos para miembros no registrados
    guest_name = Column(String, nullable=True)  # Nombre del miembro no registrado
    guest_email = Column(String, nullable=True)  # Email opcional para invitaciones
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="participations")
    group = relationship("Group", back_populates="participants")

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Opcional para pagos de invitados
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=True)  # Referencia al participante
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime(timezone=True), server_default=func.now())
    receipt_url = Column(String, nullable=True)  # Cloudinary URL
    notes = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=False)
    
    # Relationships
    user = relationship("User", back_populates="payments")
    participant = relationship("Participant")
    group = relationship("Group", back_populates="payments")