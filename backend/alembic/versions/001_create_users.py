"""create users table

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.Text(), unique=True, nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("leetcode_username", sa.Text(), nullable=True),
        sa.Column("lc_session_encrypted", sa.Text(), nullable=True),
        sa.Column("lc_session_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("github_token_encrypted", sa.Text(), nullable=True),
        sa.Column("github_repo", sa.Text(), nullable=True),
        sa.Column("target_companies", ARRAY(sa.Text()), nullable=True),
        sa.Column("active_roadmap", sa.Text(), nullable=True),
        sa.Column("interview_date", sa.Date(), nullable=True),
        sa.Column("streak_current", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("streak_longest", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    op.drop_table("users")
