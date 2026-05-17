"""add promotion_rejection_note to ingredients

Revision ID: b1af3ad3f2de
Revises: 10625c3b76d1
Create Date: 2026-05-16 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1af3ad3f2de"
down_revision: str | None = "10625c3b76d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ingredients",
        sa.Column("promotion_rejection_note", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ingredients", "promotion_rejection_note")
