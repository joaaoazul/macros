"""Desafios de grupo: um objectivo partilhado numa conversa de grupo.

Sem tabela de participação: participantes são os membros do grupo, e o progresso
é derivado do que já existe (compute_plan_days), não guardado outra vez.

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-18

"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "challenges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.Integer(),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=24), nullable=False),  # days_on_plan
        sa.Column("target", sa.Integer(), nullable=False),  # dias a atingir por pessoa
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_challenges_conversation_id", "challenges", ["conversation_id"])


def downgrade() -> None:
    op.drop_index("ix_challenges_conversation_id", table_name="challenges")
    op.drop_table("challenges")
