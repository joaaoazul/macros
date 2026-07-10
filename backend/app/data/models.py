"""Per-user nutrition data models. All rows cascade-delete with the user."""

from datetime import date

from sqlalchemy import JSON, Date, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models_base import Base, TimestampMixin

def _user_fk() -> ForeignKey:
    return ForeignKey("users.id", ondelete="CASCADE")


class DbProfile(Base, TimestampMixin):
    __tablename__ = "profiles"

    user_id: Mapped[int] = mapped_column(_user_fk(), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    sex: Mapped[str] = mapped_column(String(1), nullable=False)  # 'M' | 'F'
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    height_cm: Mapped[float] = mapped_column(Float, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    activity: Mapped[float] = mapped_column(Float, nullable=False)
    goal: Mapped[str] = mapped_column(String(10), nullable=False)  # cut|maintain|bulk
    targets: Mapped[dict] = mapped_column(JSON, nullable=False)  # {kcal,protein,carbs,fat,waterMl}


class DbDiaryEntry(Base):
    __tablename__ = "diary_entries"
    __table_args__ = (UniqueConstraint("user_id", "entry_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(_user_fk(), nullable=False, index=True)
    entry_id: Mapped[str] = mapped_column(String(40), nullable=False)  # client uid()
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    meal: Mapped[str] = mapped_column(String(12), nullable=False)
    food_name: Mapped[str] = mapped_column(String(255), nullable=False)
    emoji: Mapped[str] = mapped_column(String(16), nullable=False, default="", server_default="")
    grams: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(2), nullable=False)  # g|ml
    kcal: Mapped[float] = mapped_column(Float, nullable=False)
    protein: Mapped[float] = mapped_column(Float, nullable=False)
    carbs: Mapped[float] = mapped_column(Float, nullable=False)
    fat: Mapped[float] = mapped_column(Float, nullable=False)


class DbWater(Base):
    __tablename__ = "water"
    __table_args__ = (UniqueConstraint("user_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(_user_fk(), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    ml: Mapped[int] = mapped_column(Integer, nullable=False)


class DbExercise(Base):
    __tablename__ = "exercises"
    __table_args__ = (UniqueConstraint("user_id", "exercise_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(_user_fk(), nullable=False, index=True)
    exercise_id: Mapped[str] = mapped_column(String(40), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kcal: Mapped[float] = mapped_column(Float, nullable=False)


class DbCustomFood(Base):
    __tablename__ = "custom_foods"
    __table_args__ = (UniqueConstraint("user_id", "food_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(_user_fk(), nullable=False, index=True)
    food_id: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    emoji: Mapped[str] = mapped_column(String(16), nullable=False, default="", server_default="")
    kcal: Mapped[float] = mapped_column(Float, nullable=False)
    protein: Mapped[float] = mapped_column(Float, nullable=False)
    carbs: Mapped[float] = mapped_column(Float, nullable=False)
    fat: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(2), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(255), nullable=True)
