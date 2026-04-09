from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.encryption import encrypt
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.user import ConnectGitHubRequest, ConnectLeetCodeRequest, UpdateProfileRequest

router = APIRouter()


@router.patch("/me", response_model=UserOut)
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.leetcode_username is not None:
        user.leetcode_username = body.leetcode_username
    if body.target_companies is not None:
        user.target_companies = body.target_companies
    if body.active_roadmap is not None:
        user.active_roadmap = body.active_roadmap
    if body.interview_date is not None:
        user.interview_date = body.interview_date
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/me/leetcode", response_model=UserOut)
async def connect_leetcode(
    body: ConnectLeetCodeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.lc_session_encrypted = encrypt(body.session_cookie)
    user.lc_session_expires_at = None
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/me/leetcode")
async def disconnect_leetcode(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.lc_session_encrypted = None
    user.lc_session_expires_at = None
    await db.commit()
    return {"message": "LeetCode disconnected"}


@router.post("/me/github", response_model=UserOut)
async def connect_github(
    body: ConnectGitHubRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.github_token_encrypted = encrypt(body.token)
    user.github_repo = body.repo
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/me/github")
async def disconnect_github(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.github_token_encrypted = None
    user.github_repo = None
    await db.commit()
    return {"message": "GitHub disconnected"}
