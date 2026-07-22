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
    birthdate: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO YYYY-MM-DD
    body_fat_pct: Mapped[float | None] = mapped_column(Float, nullable=True)


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


class DbWeight(Base):
    __tablename__ = "weights"
    __table_args__ = (UniqueConstraint("user_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(_user_fk(), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    kg: Mapped[float] = mapped_column(Float, nullable=False)


class DbRecipe(Base, TimestampMixin):
    """Combinação/receita guardada: vários itens (snapshots) registados de uma vez.

    auto=True são combinações "usadas anteriormente" (sem nome, LRU no cliente);
    auto=False são receitas nomeadas pelo utilizador.
    """

    __tablename__ = "recipes"
    __table_args__ = (UniqueConstraint("user_id", "recipe_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(_user_fk(), nullable=False, index=True)
    recipe_id: Mapped[str] = mapped_column(String(40), nullable=False)  # client uid()
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    emoji: Mapped[str] = mapped_column(String(16), nullable=False, default="🍽️", server_default="🍽️")
    auto: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)
    items: Mapped[list] = mapped_column(JSON, nullable=False)  # [{foodName,emoji,grams,unit,kcal,protein,carbs,fat}]


class DbMealPlanEntry(Base):
    """Uma refeição planeada (almoço/jantar) num dia da semana (0=segunda..6=domingo).

    items são snapshots (como nas receitas) para a lista de compras não partir se a
    receita de origem for editada/apagada.
    """

    __tablename__ = "meal_plan_entries"
    __table_args__ = (UniqueConstraint("user_id", "entry_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(_user_fk(), nullable=False, index=True)
    entry_id: Mapped[str] = mapped_column(String(40), nullable=False)  # client uid()
    day: Mapped[int] = mapped_column(Integer, nullable=False)  # 0..6 (segunda..domingo)
    meal: Mapped[str] = mapped_column(String(8), nullable=False)  # lunch|dinner
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    emoji: Mapped[str] = mapped_column(String(16), nullable=False, default="🍽️", server_default="🍽️")
    servings: Mapped[float] = mapped_column(Float, nullable=False, default=1, server_default="1")
    items: Mapped[list] = mapped_column(JSON, nullable=False)  # [{foodName,emoji,grams,unit,kcal,...}]


class DbPantryItem(Base):
    """Despensa: kind='have' (tenho sempre → excluir da lista) ou 'recurring'
    (adicionar sempre à lista, ex.: aveia/ovos do pequeno-almoço)."""

    __tablename__ = "pantry_items"
    __table_args__ = (UniqueConstraint("user_id", "item_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(_user_fk(), nullable=False, index=True)
    item_id: Mapped[str] = mapped_column(String(40), nullable=False)  # client uid()
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # have|recurring
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    emoji: Mapped[str] = mapped_column(String(16), nullable=False, default="", server_default="")
    grams: Mapped[float | None] = mapped_column(Float, nullable=True)  # p/ recorrentes
    unit: Mapped[str | None] = mapped_column(String(2), nullable=True)  # g|ml
    qty: Mapped[float | None] = mapped_column(Float, nullable=True)  # nº de unidades (kind='stock')
    expires_on: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO YYYY-MM-DD


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
    fiber: Mapped[float | None] = mapped_column(Float, nullable=True)
    sugar: Mapped[float | None] = mapped_column(Float, nullable=True)
    saturates: Mapped[float | None] = mapped_column(Float, nullable=True)
    salt: Mapped[float | None] = mapped_column(Float, nullable=True)
    portions: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{label,grams}]
