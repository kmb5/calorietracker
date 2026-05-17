"""add meal_logs and meal_log_entries tables

Revision ID: a1b2c3d4e5f6
Revises: 10625c3b76d1
Create Date: 2026-05-16 00:00:00.000000

Note: recipe_id carries a proper FK to recipes.id — the recipes table
(issue #15) merged before this migration was finalised.
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
    # Create mealtype enum
    mealtype_enum = sa.Enum("breakfast", "lunch", "dinner", "snack", name="mealtype")
    mealtype_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "meal_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("logged_date", sa.Date(), nullable=False),
        sa.Column(
            "meal_type",
            sa.Enum("breakfast", "lunch", "dinner", "snack", name="mealtype"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
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
    op.create_index(
        op.f("ix_meal_logs_user_id"), "meal_logs", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_meal_logs_logged_date"), "meal_logs", ["logged_date"], unique=False
    )

    op.create_table(
        "meal_log_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meal_log_id", sa.Integer(), nullable=False),
        sa.Column("ingredient_id", sa.Integer(), nullable=True),
        sa.Column("recipe_id", sa.Integer(), nullable=True),
        sa.Column("amount_g", sa.Float(), nullable=False),
        sa.Column("kcal", sa.Float(), nullable=False),
        sa.Column("protein_g", sa.Float(), nullable=False),
        sa.Column("fat_g", sa.Float(), nullable=False),
        sa.Column("carbohydrates_g", sa.Float(), nullable=False),
        sa.Column("fiber_g", sa.Float(), nullable=False),
        sa.Column("sodium_mg", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["meal_log_id"], ["meal_logs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["ingredient_id"], ["ingredients.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_meal_log_entries_id"), "meal_log_entries", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_meal_log_entries_meal_log_id"),
        "meal_log_entries",
        ["meal_log_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_meal_log_entries_meal_log_id"), table_name="meal_log_entries"
    )
    op.drop_index(op.f("ix_meal_log_entries_id"), table_name="meal_log_entries")
    op.drop_table("meal_log_entries")

    op.drop_index(op.f("ix_meal_logs_logged_date"), table_name="meal_logs")
    op.drop_index(op.f("ix_meal_logs_user_id"), table_name="meal_logs")
    op.drop_index(op.f("ix_meal_logs_id"), table_name="meal_logs")
    op.drop_table("meal_logs")

    sa.Enum(name="mealtype").drop(op.get_bind(), checkfirst=True)
