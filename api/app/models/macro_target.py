from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class MacroTarget(Base):
    __tablename__ = "macro_targets"
    __table_args__ = (UniqueConstraint("user_id", name="uq_macro_targets_user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kcal_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    protein_g_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_g_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbohydrates_g_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    fiber_g_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    sodium_mg_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship("User")
