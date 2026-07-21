"""Billing/acesso: trial, estado da subscrição, cliente Stripe e convidados (comped).

Colunas nulláveis / com server_default — contas existentes continuam válidas.
Nota operacional: enquanto STRIPE_SECRET_KEY estiver vazio o billing está
desligado e toda a gente tem acesso; ao ligar o Stripe, dá trial ou comp às
contas antigas (subscription_status fica 'none' por omissão nelas).

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-21

"""
from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("subscription_status", sa.String(length=16), server_default="none", nullable=False),
    )
    op.add_column("users", sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users", sa.Column("comped", sa.Boolean(), server_default=sa.false(), nullable=False)
    )
    op.create_index("ix_users_stripe_customer_id", "users", ["stripe_customer_id"])


def downgrade() -> None:
    op.drop_index("ix_users_stripe_customer_id", table_name="users")
    op.drop_column("users", "comped")
    op.drop_column("users", "current_period_end")
    op.drop_column("users", "subscription_status")
    op.drop_column("users", "trial_ends_at")
    op.drop_column("users", "stripe_customer_id")
