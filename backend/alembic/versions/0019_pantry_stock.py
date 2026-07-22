"""Despensa em stock: quantidade e data de validade nos itens (kind='stock').

Colunas nulláveis — os itens 'have'/'recurring' existentes não mudam.

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-22

"""
from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pantry_items", sa.Column("qty", sa.Float(), nullable=True))
    op.add_column("pantry_items", sa.Column("expires_on", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("pantry_items", "expires_on")
    op.drop_column("pantry_items", "qty")
