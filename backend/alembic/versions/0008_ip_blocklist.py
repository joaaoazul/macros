"""IP blocklist table.

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ip_blocklist",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ip", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("ip"),
    )


def downgrade() -> None:
    op.drop_table("ip_blocklist")
