"""Lista de compras sincronizada: itens escritos à mão e riscados.

Uma linha por utilizador com dois arrays JSON. Os dados são pequenos, sem
identidade nem ordem por item, e substituídos por inteiro a cada escrita —
linha-por-item obrigaria a ids sintéticos e a apagar-e-reinserir a cada toque
numa caixa.

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-22

"""
from alembic import op
import sqlalchemy as sa

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shopping_lists",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("extras", sa.JSON(), nullable=False),
        sa.Column("checked", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("shopping_lists")
