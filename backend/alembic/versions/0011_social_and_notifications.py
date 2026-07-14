"""Reactions, nudges, badges, message reactions/photos and the notification inbox.

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-14

"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- notification inbox + per-category prefs ---
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.String(length=300), nullable=False, server_default=""),
        sa.Column("url", sa.String(length=120), nullable=False, server_default="/app"),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])

    op.create_table(
        "notification_prefs",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("messages", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("friends", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("social", sa.Boolean(), nullable=False, server_default="true"),
    )

    # --- feed reactions ---
    op.create_table(
        "feed_reactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("feed_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("emoji", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("event_id", "user_id"),
    )
    op.create_index("ix_feed_reactions_event_id", "feed_reactions", ["event_id"])
    op.create_index("ix_feed_reactions_user_id", "feed_reactions", ["user_id"])

    # --- nudges ---
    op.create_table(
        "nudges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("from_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_nudges_from_user_id", "nudges", ["from_user_id"])
    op.create_index("ix_nudges_to_user_id", "nudges", ["to_user_id"])
    op.create_index("ix_nudges_pair_time", "nudges", ["from_user_id", "to_user_id", "created_at"])

    # --- badges ---
    op.create_table(
        "badges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("earned_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "kind"),
    )
    op.create_index("ix_badges_user_id", "badges", ["user_id"])

    # --- message photos + reactions ---
    op.add_column("messages", sa.Column("image", sa.Text(), nullable=True))
    op.alter_column("messages", "body", server_default="")
    op.create_table(
        "message_reactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("message_id", sa.Integer(), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("emoji", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("message_id", "user_id"),
    )
    op.create_index("ix_message_reactions_message_id", "message_reactions", ["message_id"])
    op.create_index("ix_message_reactions_user_id", "message_reactions", ["user_id"])


def downgrade() -> None:
    op.drop_table("message_reactions")
    op.drop_column("messages", "image")
    op.drop_index("ix_badges_user_id", table_name="badges")
    op.drop_table("badges")
    op.drop_index("ix_nudges_pair_time", table_name="nudges")
    op.drop_index("ix_nudges_to_user_id", table_name="nudges")
    op.drop_index("ix_nudges_from_user_id", table_name="nudges")
    op.drop_table("nudges")
    op.drop_index("ix_feed_reactions_user_id", table_name="feed_reactions")
    op.drop_index("ix_feed_reactions_event_id", table_name="feed_reactions")
    op.drop_table("feed_reactions")
    op.drop_table("notification_prefs")
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
