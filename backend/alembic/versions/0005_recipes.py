"""Recipes / saved combos table.

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-11

"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipe_id", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("emoji", sa.String(length=16), nullable=False, server_default="🍽️"),
        sa.Column("auto", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "recipe_id"),
    )
    op.create_index("ix_recipes_user_id", "recipes", ["user_id"])


def downgrade() -> None:
    op.drop_table("recipes")
