"""Models for the meal log feature."""

import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MealType(enum.StrEnum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"


class MealLog(Base):
    __tablename__ = "meal_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    logged_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    meal_type: Mapped[MealType] = mapped_column(
        Enum(MealType, name="mealtype"), nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    entries: Mapped[list["MealLogEntry"]] = relationship(
        "MealLogEntry", back_populates="meal_log", lazy="select"
    )


class MealLogEntry(Base):
    __tablename__ = "meal_log_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    meal_log_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("meal_logs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Nullable FKs: one of these should be set (ingredient-based or recipe-based)
    ingredient_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("ingredients.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    # recipe_id references a table that does not yet exist; stored as plain int for now
    recipe_id: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    amount_g: Mapped[float] = mapped_column(Float, nullable=False)
    # Snapshotted nutrition values — immutable after creation
    kcal: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbohydrates_g: Mapped[float] = mapped_column(Float, nullable=False)
    fiber_g: Mapped[float] = mapped_column(Float, nullable=False)
    sodium_mg: Mapped[float] = mapped_column(Float, nullable=False)
    meal_log: Mapped["MealLog"] = relationship("MealLog", back_populates="entries")
