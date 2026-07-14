"""Per-user data endpoints: load-all, day upsert, profile, custom foods, import."""

from datetime import date as date_type
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.data.models import (
    DbCustomFood,
    DbDiaryEntry,
    DbExercise,
    DbMealPlanEntry,
    DbPantryItem,
    DbProfile,
    DbRecipe,
    DbWater,
    DbWeight,
)
from app.data.schemas import (
    AllData,
    DayUpsert,
    Entry,
    Exercise,
    Food,
    ImportPayload,
    MealPlanEntry,
    PantryItem,
    Profile,
    Recipe,
    Weight,
    WeightIn,
)
from app.database import get_db
from app.exceptions import ValidationError

router = APIRouter(prefix="/api/v1", tags=["data"])


def _parse_date(iso: str) -> date_type:
    try:
        return datetime.strptime(iso, "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError(f"Data inválida: {iso}")


def _dedupe(items: list, key) -> list:
    """Remove duplicados por id do cliente (última ocorrência ganha, ordem preservada).

    Impede que um payload com ids repetidos (replay/glitch do cliente) viole a
    UniqueConstraint no commit e rebente com um 500 cru.
    """
    by_id = {key(i): i for i in items}
    return list(by_id.values())


def _profile_out(p: DbProfile) -> Profile:
    return Profile(
        name=p.name, sex=p.sex, age=p.age, heightCm=p.height_cm, weightKg=p.weight_kg,
        activity=p.activity, goal=p.goal, targets=p.targets,
    )


def _entry_out(e: DbDiaryEntry) -> Entry:
    return Entry(
        id=e.entry_id, meal=e.meal, foodName=e.food_name, emoji=e.emoji, grams=e.grams,
        unit=e.unit, kcal=e.kcal, protein=e.protein, carbs=e.carbs, fat=e.fat,
    )


def _entry_row(user_id: int, iso: date_type, e: Entry) -> DbDiaryEntry:
    return DbDiaryEntry(
        user_id=user_id, entry_id=e.id, date=iso, meal=e.meal, food_name=e.foodName,
        emoji=e.emoji, grams=e.grams, unit=e.unit, kcal=e.kcal, protein=e.protein,
        carbs=e.carbs, fat=e.fat,
    )


def _exercise_row(user_id: int, iso: date_type, x: Exercise) -> DbExercise:
    return DbExercise(user_id=user_id, exercise_id=x.id, date=iso, name=x.name, kcal=x.kcal)


def _food_row(user_id: int, f: Food) -> DbCustomFood:
    return DbCustomFood(
        user_id=user_id, food_id=f.id, name=f.name, emoji=f.emoji, kcal=f.kcal,
        protein=f.protein, carbs=f.carbs, fat=f.fat, unit=f.unit, brand=f.brand,
        fiber=f.fiber, sugar=f.sugar, saturates=f.saturates, salt=f.salt,
        portions=[p.model_dump() for p in f.portions] if f.portions else None,
    )


def _food_out(f: DbCustomFood) -> Food:
    return Food(
        id=f.food_id, name=f.name, emoji=f.emoji, kcal=f.kcal, protein=f.protein,
        carbs=f.carbs, fat=f.fat, unit=f.unit, custom=True, brand=f.brand,
        fiber=f.fiber, sugar=f.sugar, saturates=f.saturates, salt=f.salt,
        portions=f.portions,
    )


def _recipe_row(user_id: int, r: Recipe) -> DbRecipe:
    return DbRecipe(
        user_id=user_id, recipe_id=r.id, name=r.name, emoji=r.emoji, auto=r.auto,
        items=[i.model_dump() for i in r.items],
    )


def _recipe_out(r: DbRecipe) -> Recipe:
    return Recipe(id=r.recipe_id, name=r.name, emoji=r.emoji, auto=r.auto, items=r.items)


def _plan_row(user_id: int, m: MealPlanEntry) -> DbMealPlanEntry:
    return DbMealPlanEntry(
        user_id=user_id, entry_id=m.id, day=m.day, meal=m.meal, name=m.name,
        emoji=m.emoji, servings=m.servings, items=[i.model_dump() for i in m.items],
    )


def _plan_out(m: DbMealPlanEntry) -> MealPlanEntry:
    return MealPlanEntry(
        id=m.entry_id, day=m.day, meal=m.meal, name=m.name, emoji=m.emoji,
        servings=m.servings, items=m.items,
    )


def _pantry_row(user_id: int, p: PantryItem) -> DbPantryItem:
    return DbPantryItem(
        user_id=user_id, item_id=p.id, kind=p.kind, name=p.name, emoji=p.emoji,
        grams=p.grams, unit=p.unit,
    )


def _pantry_out(p: DbPantryItem) -> PantryItem:
    return PantryItem(id=p.item_id, kind=p.kind, name=p.name, emoji=p.emoji, grams=p.grams, unit=p.unit)


async def _load_all(db: AsyncSession, user_id: int) -> AllData:
    profile = (
        await db.execute(select(DbProfile).where(DbProfile.user_id == user_id))
    ).scalar_one_or_none()

    diary: dict[str, list[Entry]] = {}
    for e in (await db.execute(select(DbDiaryEntry).where(DbDiaryEntry.user_id == user_id))).scalars():
        diary.setdefault(e.date.isoformat(), []).append(_entry_out(e))

    water = {
        w.date.isoformat(): w.ml
        for w in (await db.execute(select(DbWater).where(DbWater.user_id == user_id))).scalars()
    }

    exercise: dict[str, list[Exercise]] = {}
    for x in (await db.execute(select(DbExercise).where(DbExercise.user_id == user_id))).scalars():
        exercise.setdefault(x.date.isoformat(), []).append(Exercise(id=x.exercise_id, name=x.name, kcal=x.kcal))

    foods = [
        _food_out(f)
        for f in (await db.execute(select(DbCustomFood).where(DbCustomFood.user_id == user_id))).scalars()
    ]

    recipes = [
        _recipe_out(r)
        for r in (
            await db.execute(
                select(DbRecipe).where(DbRecipe.user_id == user_id).order_by(DbRecipe.updated_at.desc())
            )
        ).scalars()
    ]

    meal_plan = [
        _plan_out(m)
        for m in (
            await db.execute(select(DbMealPlanEntry).where(DbMealPlanEntry.user_id == user_id))
        ).scalars()
    ]

    pantry = [
        _pantry_out(p)
        for p in (
            await db.execute(select(DbPantryItem).where(DbPantryItem.user_id == user_id))
        ).scalars()
    ]

    return AllData(
        profile=_profile_out(profile) if profile else None,
        diary=diary,
        water=water,
        exercise=exercise,
        customFoods=foods,
        recipes=recipes,
        mealPlan=meal_plan,
        pantry=pantry,
    )


@router.get("/data/all", response_model=AllData)
async def get_all(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AllData:
    return await _load_all(db, user.id)


@router.put("/profile", response_model=Profile)
async def put_profile(
    body: Profile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Profile:
    existing = (
        await db.execute(select(DbProfile).where(DbProfile.user_id == user.id))
    ).scalar_one_or_none()
    if existing:
        existing.name = body.name
        existing.sex = body.sex
        existing.age = body.age
        existing.height_cm = body.heightCm
        existing.weight_kg = body.weightKg
        existing.activity = body.activity
        existing.goal = body.goal
        existing.targets = body.targets.model_dump()
    else:
        db.add(
            DbProfile(
                user_id=user.id, name=body.name, sex=body.sex, age=body.age,
                height_cm=body.heightCm, weight_kg=body.weightKg, activity=body.activity,
                goal=body.goal, targets=body.targets.model_dump(),
            )
        )
    return body


@router.put("/days/{iso_date}", response_model=DayUpsert)
async def put_day(
    iso_date: str,
    body: DayUpsert,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DayUpsert:
    """Atomically replace the provided sections of one day (idempotent, replay-safe)."""
    day = _parse_date(iso_date)

    if body.entries is not None:
        await db.execute(
            delete(DbDiaryEntry).where(DbDiaryEntry.user_id == user.id, DbDiaryEntry.date == day)
        )
        for e in _dedupe(body.entries, lambda e: e.id):
            db.add(_entry_row(user.id, day, e))

    if body.waterMl is not None:
        await db.execute(delete(DbWater).where(DbWater.user_id == user.id, DbWater.date == day))
        if body.waterMl > 0:
            db.add(DbWater(user_id=user.id, date=day, ml=body.waterMl))

    if body.exercises is not None:
        await db.execute(
            delete(DbExercise).where(DbExercise.user_id == user.id, DbExercise.date == day)
        )
        for x in _dedupe(body.exercises, lambda x: x.id):
            db.add(_exercise_row(user.id, day, x))

    await db.flush()
    # avaliar conquistas do feed — nunca pode partir a gravação (protegido internamente)
    from app.social.service import evaluate_day_events

    await evaluate_day_events(db, user.id, day)

    return body


@router.put("/custom-foods", response_model=list[Food])
async def put_custom_foods(
    body: list[Food],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Food]:
    if len(body) > 2000:
        raise ValidationError("Demasiados alimentos personalizados.")
    await db.execute(delete(DbCustomFood).where(DbCustomFood.user_id == user.id))
    for f in _dedupe(body, lambda f: f.id):
        db.add(_food_row(user.id, f))
    return body


@router.put("/recipes", response_model=list[Recipe])
async def put_recipes(
    body: list[Recipe],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Recipe]:
    if len(body) > 200:
        raise ValidationError("Demasiadas combinações/receitas.")
    await db.execute(delete(DbRecipe).where(DbRecipe.user_id == user.id))
    for r in _dedupe(body, lambda r: r.id):
        db.add(_recipe_row(user.id, r))
    return body


@router.put("/meal-plan", response_model=list[MealPlanEntry])
async def put_meal_plan(
    body: list[MealPlanEntry],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MealPlanEntry]:
    if len(body) > 200:
        raise ValidationError("Plano de refeições demasiado grande.")
    await db.execute(delete(DbMealPlanEntry).where(DbMealPlanEntry.user_id == user.id))
    for m in _dedupe(body, lambda m: m.id):
        db.add(_plan_row(user.id, m))
    return body


@router.put("/pantry", response_model=list[PantryItem])
async def put_pantry(
    body: list[PantryItem],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PantryItem]:
    if len(body) > 500:
        raise ValidationError("Despensa demasiado grande.")
    await db.execute(delete(DbPantryItem).where(DbPantryItem.user_id == user.id))
    for p in _dedupe(body, lambda p: p.id):
        db.add(_pantry_row(user.id, p))
    return body


@router.get("/weights", response_model=list[Weight])
async def list_weights(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Weight]:
    result = await db.execute(
        select(DbWeight).where(DbWeight.user_id == user.id).order_by(DbWeight.date)
    )
    return [Weight(date=w.date.isoformat(), kg=w.kg) for w in result.scalars()]


@router.put("/weights/{iso_date}", response_model=Weight)
async def put_weight(
    iso_date: str,
    body: WeightIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Weight:
    day = _parse_date(iso_date)
    await db.execute(delete(DbWeight).where(DbWeight.user_id == user.id, DbWeight.date == day))
    db.add(DbWeight(user_id=user.id, date=day, kg=body.kg))
    return Weight(date=iso_date, kg=body.kg)


@router.delete("/weights/{iso_date}", status_code=204)
async def delete_weight(
    iso_date: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    day = _parse_date(iso_date)
    await db.execute(delete(DbWeight).where(DbWeight.user_id == user.id, DbWeight.date == day))


@router.post("/data/import", response_model=AllData)
async def import_data(
    body: ImportPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AllData:
    """One-time migration of device localStorage data. Fills gaps only — server data wins."""
    current = await _load_all(db, user.id)

    if body.profile and current.profile is None:
        await put_profile(body.profile, db, user)

    # ids já usados globalmente — evita violar a UniqueConstraint (user_id, *_id)
    # com um export corrompido que repita ids dentro/entre dias.
    seen_entry_ids: set[str] = set()
    for iso, entries in body.diary.items():
        if iso not in current.diary and entries:
            day = _parse_date(iso)
            for e in entries:
                if e.id not in seen_entry_ids:
                    seen_entry_ids.add(e.id)
                    db.add(_entry_row(user.id, day, e))

    for iso, ml in body.water.items():
        if iso not in current.water and ml > 0:
            db.add(DbWater(user_id=user.id, date=_parse_date(iso), ml=ml))

    seen_exercise_ids: set[str] = set()
    for iso, exercises in body.exercise.items():
        if iso not in current.exercise and exercises:
            day = _parse_date(iso)
            for x in exercises:
                if x.id not in seen_exercise_ids:
                    seen_exercise_ids.add(x.id)
                    db.add(_exercise_row(user.id, day, x))

    existing_food_ids = {f.id for f in current.customFoods}
    for f in _dedupe(body.customFoods, lambda f: f.id):
        if f.id not in existing_food_ids:
            db.add(_food_row(user.id, f))

    existing_recipe_ids = {r.id for r in current.recipes}
    for r in _dedupe(body.recipes, lambda r: r.id):
        if r.id not in existing_recipe_ids:
            db.add(_recipe_row(user.id, r))

    existing_plan_ids = {m.id for m in current.mealPlan}
    for m in _dedupe(body.mealPlan, lambda m: m.id):
        if m.id not in existing_plan_ids:
            db.add(_plan_row(user.id, m))

    existing_pantry_ids = {p.id for p in current.pantry}
    for p in _dedupe(body.pantry, lambda p: p.id):
        if p.id not in existing_pantry_ids:
            db.add(_pantry_row(user.id, p))

    await db.flush()
    return await _load_all(db, user.id)
