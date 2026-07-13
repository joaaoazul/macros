"""Micronutrientes e porções caseiras nos alimentos personalizados.

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("custom_foods", sa.Column("fiber", sa.Float(), nullable=True))
    op.add_column("custom_foods", sa.Column("sugar", sa.Float(), nullable=True))
    op.add_column("custom_foods", sa.Column("saturates", sa.Float(), nullable=True))
    op.add_column("custom_foods", sa.Column("salt", sa.Float(), nullable=True))
    op.add_column("custom_foods", sa.Column("portions", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("custom_foods", "portions")
    op.drop_column("custom_foods", "salt")
    op.drop_column("custom_foods", "saturates")
    op.drop_column("custom_foods", "sugar")
    op.drop_column("custom_foods", "fiber")
