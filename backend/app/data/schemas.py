"""Pydantic schemas mirroring src/types.ts exactly (camelCase field names)."""

from typing import Literal

from pydantic import BaseModel, Field

MealId = Literal["breakfast", "lunch", "snack", "dinner", "supper"]
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


class AllData(BaseModel):
    profile: Profile | None
    diary: dict[str, list[Entry]]
    water: dict[str, int]
    exercise: dict[str, list[Exercise]]
    customFoods: list[Food]


class DayUpsert(BaseModel):
    """Replace-the-day payload; only provided fields are touched."""

    entries: list[Entry] | None = None
    waterMl: int | None = Field(default=None, ge=0, le=100000)
    exercises: list[Exercise] | None = None


class ImportPayload(BaseModel):
    profile: Profile | None = None
    diary: dict[str, list[Entry]] = {}
    water: dict[str, int] = {}
    exercise: dict[str, list[Exercise]] = {}
    customFoods: list[Food] = []


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)
