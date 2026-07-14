"""Planeador de refeições + despensa (lista de compras).

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-14

"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meal_plan_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entry_id", sa.String(length=40), nullable=False),
        sa.Column("day", sa.Integer(), nullable=False),
        sa.Column("meal", sa.String(length=8), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False, server_default="🍽️"),
        sa.Column("servings", sa.Float(), nullable=False, server_default="1"),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.UniqueConstraint("user_id", "entry_id"),
    )
    op.create_index("ix_meal_plan_entries_user_id", "meal_plan_entries", ["user_id"])

    op.create_table(
        "pantry_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.String(length=40), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False, server_default=""),
        sa.Column("grams", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=2), nullable=True),
        sa.UniqueConstraint("user_id", "item_id"),
    )
    op.create_index("ix_pantry_items_user_id", "pantry_items", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_pantry_items_user_id", table_name="pantry_items")
    op.drop_table("pantry_items")
    op.drop_index("ix_meal_plan_entries_user_id", table_name="meal_plan_entries")
    op.drop_table("meal_plan_entries")
