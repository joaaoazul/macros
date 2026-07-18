"""Conversations (DM + groups), per-member read cursors and share payloads.

Existing 1:1 messages are backfilled into type='dm' conversations; the old
read_at flag seeds each member's last_read_message_id cursor.

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-17

"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- conversations + membership ---
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("type", sa.String(length=8), nullable=False),  # 'dm' | 'group'
        sa.Column("title", sa.String(length=60), nullable=True),  # groups only
        sa.Column("emoji", sa.String(length=8), nullable=False, server_default="💬"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "conversation_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=8), nullable=False, server_default="member"),  # 'owner' | 'member'
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_read_message_id", sa.Integer(), nullable=True),
        sa.UniqueConstraint("conversation_id", "user_id"),
    )
    op.create_index("ix_conversation_members_conversation_id", "conversation_members", ["conversation_id"])
    op.create_index("ix_conversation_members_user_id", "conversation_members", ["user_id"])

    # --- messages: conversation link + share payload ---
    op.add_column("messages", sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True))
    op.add_column("messages", sa.Column("share", sa.JSON(), nullable=True))
    op.alter_column("messages", "recipient_id", existing_type=sa.Integer(), nullable=True)
    op.create_index("ix_messages_conversation", "messages", ["conversation_id", "id"])

    # --- backfill: one dm conversation per distinct pair ---
    bind = op.get_bind()
    pairs = bind.execute(
        sa.text(
            "SELECT DISTINCT least(sender_id, recipient_id) AS a, greatest(sender_id, recipient_id) AS b "
            "FROM messages WHERE recipient_id IS NOT NULL"
        )
    ).fetchall()
    for a, b in pairs:
        conv_id = bind.execute(
            sa.text("INSERT INTO conversations (type, emoji) VALUES ('dm', '💬') RETURNING id")
        ).scalar()
        bind.execute(
            sa.text(
                "INSERT INTO conversation_members (conversation_id, user_id, role) "
                "VALUES (:c, :a, 'member'), (:c, :b, 'member')"
            ),
            {"c": conv_id, "a": a, "b": b},
        )
        bind.execute(
            sa.text(
                "UPDATE messages SET conversation_id = :c "
                "WHERE (sender_id = :a AND recipient_id = :b) OR (sender_id = :b AND recipient_id = :a)"
            ),
            {"c": conv_id, "a": a, "b": b},
        )
        # Seed each member's cursor from the old read_at flags: the newest
        # incoming message they had already read.
        for uid, other in ((a, b), (b, a)):
            last_read = bind.execute(
                sa.text(
                    "SELECT max(id) FROM messages "
                    "WHERE recipient_id = :u AND sender_id = :o AND read_at IS NOT NULL"
                ),
                {"u": uid, "o": other},
            ).scalar()
            if last_read is not None:
                bind.execute(
                    sa.text(
                        "UPDATE conversation_members SET last_read_message_id = :m "
                        "WHERE conversation_id = :c AND user_id = :u"
                    ),
                    {"m": last_read, "c": conv_id, "u": uid},
                )


def downgrade() -> None:
    op.drop_index("ix_messages_conversation", table_name="messages")
    op.alter_column("messages", "recipient_id", existing_type=sa.Integer(), nullable=False)
    op.drop_column("messages", "share")
    op.drop_column("messages", "conversation_id")
    op.drop_index("ix_conversation_members_user_id", table_name="conversation_members")
    op.drop_index("ix_conversation_members_conversation_id", table_name="conversation_members")
    op.drop_table("conversation_members")
    op.drop_table("conversations")
