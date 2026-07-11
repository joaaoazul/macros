"""Social: username/avatar, friendships, feed events, messages, leaderboard ranks.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-11

"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(20), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.add_column(
        "users",
        sa.Column("avatar", sa.String(16), nullable=False, server_default="🙂"),
    )

    op.create_table(
        "friendships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("requester_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("addressee_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),  # pending | accepted
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("requester_id", "addressee_id"),
        sa.CheckConstraint("requester_id != addressee_id", name="ck_friendship_not_self"),
    )
    op.create_index("ix_friendships_requester_id", "friendships", ["requester_id"])
    op.create_index("ix_friendships_addressee_id", "friendships", ["addressee_id"])

    op.create_table(
        "feed_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("ref_date", sa.Date(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "kind", "ref_date"),
    )
    op.create_index("ix_feed_events_user_id", "feed_events", ["user_id"])

    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.String(2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_messages_recipient_id", "messages", ["recipient_id"])
    op.create_index("ix_messages_pair", "messages", ["sender_id", "recipient_id", "id"])
    op.create_index("ix_messages_unread", "messages", ["recipient_id", "read_at"])

    op.create_table(
        "leaderboard_ranks",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("iso_week", sa.String(8), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("leaderboard_ranks")
    op.drop_table("messages")
    op.drop_table("feed_events")
    op.drop_table("friendships")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "avatar")
    op.drop_column("users", "username")
