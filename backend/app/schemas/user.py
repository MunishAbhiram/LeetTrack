from datetime import date

from pydantic import BaseModel


class UpdateProfileRequest(BaseModel):
    leetcode_username: str | None = None
    target_companies: list[str] | None = None
    active_roadmap: str | None = None
    interview_date: date | None = None


class ConnectLeetCodeRequest(BaseModel):
    session_cookie: str


class ConnectGitHubRequest(BaseModel):
    token: str
    repo: str  # "owner/repo"
