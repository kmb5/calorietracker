"""add macro_targets table

Revision ID: a1b2c3d4e5f6
Revises: 10625c3b76d1
Create Date: 2026-05-16 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "10625c3b76d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "macro_targets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kcal_target", sa.Float(), nullable=True),
        sa.Column("protein_g_target", sa.Float(), nullable=True),
        sa.Column("fat_g_target", sa.Float(), nullable=True),
        sa.Column("carbohydrates_g_target", sa.Float(), nullable=True),
        sa.Column("fiber_g_target", sa.Float(), nullable=True),
        sa.Column("sodium_mg_target", sa.Float(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_macro_targets_user_id"),
    )
    op.create_index(
        op.f("ix_macro_targets_id"), "macro_targets", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_macro_targets_user_id"), "macro_targets", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_macro_targets_user_id"), table_name="macro_targets")
    op.drop_index(op.f("ix_macro_targets_id"), table_name="macro_targets")
    op.drop_table("macro_targets")
