"""Profile photo + bio on users.

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-11

"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_photo", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("bio", sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "bio")
    op.drop_column("users", "avatar_photo")
