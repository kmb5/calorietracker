import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UnitType(enum.StrEnum):
    g = "g"
    ml = "ml"
    tablespoon = "tablespoon"
    piece = "piece"


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    unit: Mapped[UnitType] = mapped_column(
        Enum(UnitType, name="unittype"), nullable=False
    )
    portion_size: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    kcal: Mapped[float] = mapped_column(Float, nullable=False)
    protein: Mapped[float] = mapped_column(Float, nullable=False)
    fat: Mapped[float] = mapped_column(Float, nullable=False)
    carbohydrates: Mapped[float] = mapped_column(Float, nullable=False)
    fiber: Mapped[float] = mapped_column(Float, nullable=False)
    sodium: Mapped[float] = mapped_column(Float, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    owner_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    is_promotion_pending: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
