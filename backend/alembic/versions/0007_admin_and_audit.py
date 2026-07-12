"""Admin flag on users + severity/user_agent on audit_logs.

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "audit_logs",
        sa.Column("severity", sa.String(length=10), nullable=False, server_default="info"),
    )
    op.add_column(
        "audit_logs",
        sa.Column("user_agent", sa.String(length=256), nullable=False, server_default=""),
    )
    op.create_index("ix_audit_logs_severity", "audit_logs", ["severity"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_severity", table_name="audit_logs")
    op.drop_column("audit_logs", "user_agent")
    op.drop_column("audit_logs", "severity")
    op.drop_column("users", "is_admin")
