"""Responder a uma mensagem (citação).

SET NULL e não CASCADE: se a mensagem citada desaparecer, a resposta continua a
existir — perde só a citação.

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-18

"""
from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column(
            "reply_to_id",
            sa.Integer(),
            sa.ForeignKey("messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_messages_reply_to_id", "messages", ["reply_to_id"])


def downgrade() -> None:
    op.drop_index("ix_messages_reply_to_id", table_name="messages")
    op.drop_column("messages", "reply_to_id")
