"""MealLog and MealLogEntry models."""

import enum
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MealType(enum.StrEnum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"


class MealLog(Base):
    __tablename__ = "meal_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    logged_date: Mapped[date] = mapped_column(Date, nullable=False)
    meal_type: Mapped[MealType] = mapped_column(
        Enum(MealType, name="mealtype"), nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    entries: Mapped[list["MealLogEntry"]] = relationship(
        "MealLogEntry", back_populates="meal_log", cascade="all, delete-orphan"
    )


class MealLogEntry(Base):
    __tablename__ = "meal_log_entries"
    __table_args__ = (
        Index("ix_meal_log_entries_user_logged_date", "user_id", "logged_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meal_log_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("meal_logs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Denormalized for fast calendar aggregation — avoids a join to meal_logs
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    logged_date: Mapped[date] = mapped_column(Date, nullable=False)

    ingredient_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("ingredients.id", ondelete="SET NULL"),
        nullable=True,
    )
    recipe_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    amount_g: Mapped[float] = mapped_column(Float, nullable=False)

    # Snapshotted nutrition — immutable after creation
    kcal: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbohydrates_g: Mapped[float] = mapped_column(Float, nullable=False)
    fiber_g: Mapped[float] = mapped_column(Float, nullable=False)
    sodium_mg: Mapped[float] = mapped_column(Float, nullable=False)

    meal_log: Mapped["MealLog"] = relationship("MealLog", back_populates="entries")
