from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Password reset schemas
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str

# Profile update schemas
class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# Group schemas
class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    payment_amount: float
    payment_frequency: str

class GroupCreate(GroupBase):
    pass

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    payment_amount: Optional[float] = None
    payment_frequency: Optional[str] = None

class Group(GroupBase):
    id: int
    public_id: str
    owner_id: int
    created_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

class GroupWithStats(Group):
    total_participants: int
    total_payments: float
    next_payment_due: Optional[datetime] = None

# Participant schemas
class ParticipantBase(BaseModel):
    user_id: Optional[int] = None
    group_id: int
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None

class ParticipantCreate(BaseModel):
    group_id: int
    user_id: Optional[int] = None
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None

class GuestParticipantCreate(BaseModel):
    group_id: int
    guest_name: str
    guest_email: Optional[str] = None

class ParticipantUpdate(BaseModel):
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    is_active: Optional[bool] = None

class Participant(ParticipantBase):
    id: int
    joined_at: datetime
    is_active: bool
    user: Optional[User] = None
    
    class Config:
        from_attributes = True

# Payment schemas
class PaymentBase(BaseModel):
    group_id: int
    amount: float
    notes: Optional[str] = None

class PaymentCreate(PaymentBase):
    user_id: Optional[int] = None
    participant_id: Optional[int] = None

class Payment(PaymentBase):
    id: int
    user_id: Optional[int] = None
    participant_id: Optional[int] = None
    payment_date: datetime
    receipt_url: Optional[str] = None
    is_verified: bool
    user: Optional[User] = None
    participant: Optional[Participant] = None
    
    class Config:
        from_attributes = True

# Dashboard schemas
class DashboardStats(BaseModel):
    total_groups: int
    total_payments: float
    pending_payments: int
    recent_payments: List[Payment]

# Public group view
class PublicGroupView(BaseModel):
    name: str
    description: Optional[str] = None
    payment_amount: float
    payment_frequency: str
    total_participants: int
    recent_payments: List[Payment]

# Notification schemas
class Notification(BaseModel):
    id: str
    type: str  # 'warning', 'danger', 'info'
    title: str
    message: str
    group_id: Optional[int] = None
    priority: str  # 'low', 'medium', 'high'
    created_at: datetime
    is_read: bool