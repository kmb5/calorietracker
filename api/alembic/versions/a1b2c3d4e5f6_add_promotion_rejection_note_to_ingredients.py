"""add_promotion_rejection_note_to_ingredients

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
    op.add_column(
        "ingredients",
        sa.Column("promotion_rejection_note", sa.String(1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ingredients", "promotion_rejection_note")
