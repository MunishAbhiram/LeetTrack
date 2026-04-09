from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: UUID
    email: str
    leetcode_username: str | None
    github_repo: str | None
    active_roadmap: str | None
    target_companies: list[str] | None
    last_synced_at: datetime | None
    lc_session_expires_at: datetime | None
    streak_current: int
    streak_longest: int

    model_config = {"from_attributes": True}
