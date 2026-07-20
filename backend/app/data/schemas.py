"""Pydantic schemas mirroring src/types.ts exactly (camelCase field names)."""

from typing import Literal

from pydantic import BaseModel, Field

MealId = Literal["madrugada", "breakfast", "lunch", "snack", "dinner", "supper"]
Unit = Literal["g", "ml"]


class Targets(BaseModel):
    kcal: float = Field(ge=0, le=20000)
    protein: float = Field(ge=0, le=2000)
    carbs: float = Field(ge=0, le=2000)
    fat: float = Field(ge=0, le=2000)
    waterMl: float = Field(ge=0, le=20000)


class Profile(BaseModel):
    name: str = Field(max_length=120)
    sex: Literal["M", "F"]
    age: int = Field(ge=10, le=120)
    heightCm: float = Field(ge=80, le=250)
    weightKg: float = Field(ge=25, le=400)
    activity: float = Field(ge=1.0, le=2.5)
    goal: Literal["cut", "maintain", "bulk"]
    targets: Targets
    # data de nascimento ISO (deriva a idade); % de gordura (TMB Katch-McArdle)
    birthdate: str | None = Field(default=None, max_length=10)
    bodyFatPct: float | None = Field(default=None, ge=3, le=70)


class Entry(BaseModel):
    id: str = Field(max_length=40)
    meal: MealId
    foodName: str = Field(max_length=255)
    emoji: str = Field(default="", max_length=16)
    grams: float = Field(ge=0, le=100000)
    unit: Unit
    kcal: float = Field(ge=0, le=100000)
    protein: float = Field(ge=0, le=10000)
    carbs: float = Field(ge=0, le=10000)
    fat: float = Field(ge=0, le=10000)


class Exercise(BaseModel):
    id: str = Field(max_length=40)
    name: str = Field(max_length=255)
    kcal: float = Field(ge=0, le=100000)


class Portion(BaseModel):
    label: str = Field(max_length=40)
    grams: float = Field(gt=0, le=100000)


class Food(BaseModel):
    id: str = Field(max_length=40)
    name: str = Field(max_length=255)
    emoji: str = Field(default="", max_length=16)
    kcal: float = Field(ge=0, le=10000)
    protein: float = Field(ge=0, le=1000)
    carbs: float = Field(ge=0, le=1000)
    fat: float = Field(ge=0, le=1000)
    unit: Unit
    custom: bool | None = None
    brand: str | None = Field(default=None, max_length=255)
    fiber: float | None = Field(default=None, ge=0, le=1000)
    sugar: float | None = Field(default=None, ge=0, le=1000)
    saturates: float | None = Field(default=None, ge=0, le=1000)
    salt: float | None = Field(default=None, ge=0, le=1000)
    portions: list[Portion] | None = Field(default=None, max_length=12)


class RecipeItem(BaseModel):
    """Snapshot de um ingrediente com a porção escolhida (macros absolutos)."""

    foodName: str = Field(max_length=255)
    emoji: str = Field(default="", max_length=16)
    grams: float = Field(ge=0, le=100000)
    unit: Unit
    kcal: float = Field(ge=0, le=100000)
    protein: float = Field(ge=0, le=10000)
    carbs: float = Field(ge=0, le=10000)
    fat: float = Field(ge=0, le=10000)


class Recipe(BaseModel):
    id: str = Field(max_length=40)
    name: str | None = Field(default=None, max_length=120)
    emoji: str = Field(default="🍽️", max_length=16)
    auto: bool = True
    items: list[RecipeItem] = Field(min_length=1, max_length=40)


class MealPlanEntry(BaseModel):
    """Uma refeição planeada num dia da semana. items são snapshots (como Recipe)."""

    id: str = Field(max_length=40)
    day: int = Field(ge=0, le=6)  # 0=segunda .. 6=domingo
    meal: Literal["lunch", "dinner"]
    name: str = Field(max_length=120)
    emoji: str = Field(default="🍽️", max_length=16)
    servings: float = Field(default=1, gt=0, le=50)
    items: list[RecipeItem] = Field(min_length=1, max_length=40)


class PantryItem(BaseModel):
    id: str = Field(max_length=40)
    kind: Literal["have", "recurring"]
    name: str = Field(max_length=120)
    emoji: str = Field(default="", max_length=16)
    grams: float | None = Field(default=None, ge=0, le=100000)
    unit: Unit | None = None


class AllData(BaseModel):
    profile: Profile | None
    diary: dict[str, list[Entry]]
    water: dict[str, int]
    exercise: dict[str, list[Exercise]]
    customFoods: list[Food]
    recipes: list[Recipe] = []
    mealPlan: list[MealPlanEntry] = []
    pantry: list[PantryItem] = []


class DayUpsert(BaseModel):
    """Replace-the-day payload; only provided fields are touched."""

    entries: list[Entry] | None = Field(default=None, max_length=200)
    waterMl: int | None = Field(default=None, ge=0, le=100000)
    exercises: list[Exercise] | None = Field(default=None, max_length=100)


class ImportPayload(BaseModel):
    profile: Profile | None = None
    diary: dict[str, list[Entry]] = Field(default={}, max_length=1000)
    water: dict[str, int] = Field(default={}, max_length=1000)
    exercise: dict[str, list[Exercise]] = Field(default={}, max_length=1000)
    customFoods: list[Food] = Field(default=[], max_length=2000)
    recipes: list[Recipe] = Field(default=[], max_length=200)
    mealPlan: list[MealPlanEntry] = Field(default=[], max_length=200)
    pantry: list[PantryItem] = Field(default=[], max_length=500)


# ImportPayload é a AllData mais tolerante (tudo opcional) — recipes já incluído acima.


class Weight(BaseModel):
    date: str
    kg: float = Field(ge=25, le=400)


class WeightIn(BaseModel):
    kg: float = Field(ge=25, le=400)


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)
