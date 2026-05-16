"""add meal_logs table

Revision ID: a1b2c3d4e5f6
Revises: 10625c3b76d1
Create Date: 2026-05-16 00:00:00.000000

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
    op.execute(
        "CREATE TYPE mealtype AS ENUM ('breakfast', 'lunch', 'dinner', 'snack')"
    )
    op.create_table(
        "meal_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("logged_date", sa.Date(), nullable=False),
        sa.Column("meal_type", sa.Enum("breakfast", "lunch", "dinner", "snack", name="mealtype"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_meal_logs_id"), "meal_logs", ["id"], unique=False)
    op.create_index(op.f("ix_meal_logs_user_id"), "meal_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_meal_logs_logged_date"), "meal_logs", ["logged_date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_meal_logs_logged_date"), table_name="meal_logs")
    op.drop_index(op.f("ix_meal_logs_user_id"), table_name="meal_logs")
    op.drop_index(op.f("ix_meal_logs_id"), table_name="meal_logs")
    op.drop_table("meal_logs")
    op.execute("DROP TYPE IF EXISTS mealtype")
