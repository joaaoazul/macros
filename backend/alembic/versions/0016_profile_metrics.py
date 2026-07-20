"""Perfil: data de nascimento (deriva idade) e % de gordura (TMB Katch-McArdle).

Colunas nulláveis — perfis existentes continuam válidos e caem na idade fixa /
Mifflin até o utilizador as preencher.

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-20

"""
from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("birthdate", sa.String(length=10), nullable=True))
    op.add_column("profiles", sa.Column("body_fat_pct", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "body_fat_pct")
    op.drop_column("profiles", "birthdate")
