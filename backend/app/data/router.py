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
    )


def _food_out(f: DbCustomFood) -> Food:
    return Food(
        id=f.food_id, name=f.name, emoji=f.emoji, kcal=f.kcal, protein=f.protein,
        carbs=f.carbs, fat=f.fat, unit=f.unit, custom=True, brand=f.brand,
    )


def _recipe_row(user_id: int, r: Recipe) -> DbRecipe:
    return DbRecipe(
        user_id=user_id, recipe_id=r.id, name=r.name, emoji=r.emoji, auto=r.auto,
        items=[i.model_dump() for i in r.items],
    )


def _recipe_out(r: DbRecipe) -> Recipe:
    return Recipe(id=r.recipe_id, name=r.name, emoji=r.emoji, auto=r.auto, items=r.items)


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

    return AllData(
        profile=_profile_out(profile) if profile else None,
        diary=diary,
        water=water,
        exercise=exercise,
        customFoods=foods,
        recipes=recipes,
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
        for e in body.entries:
            db.add(_entry_row(user.id, day, e))

    if body.waterMl is not None:
        await db.execute(delete(DbWater).where(DbWater.user_id == user.id, DbWater.date == day))
        if body.waterMl > 0:
            db.add(DbWater(user_id=user.id, date=day, ml=body.waterMl))

    if body.exercises is not None:
        await db.execute(
            delete(DbExercise).where(DbExercise.user_id == user.id, DbExercise.date == day)
        )
        for x in body.exercises:
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
    for f in body:
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
    for r in body:
        db.add(_recipe_row(user.id, r))
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

    for iso, entries in body.diary.items():
        if iso not in current.diary and entries:
            day = _parse_date(iso)
            for e in entries:
                db.add(_entry_row(user.id, day, e))

    for iso, ml in body.water.items():
        if iso not in current.water and ml > 0:
            db.add(DbWater(user_id=user.id, date=_parse_date(iso), ml=ml))

    for iso, exercises in body.exercise.items():
        if iso not in current.exercise and exercises:
            day = _parse_date(iso)
            for x in exercises:
                db.add(_exercise_row(user.id, day, x))

    existing_food_ids = {f.id for f in current.customFoods}
    for f in body.customFoods:
        if f.id not in existing_food_ids:
            db.add(_food_row(user.id, f))

    existing_recipe_ids = {r.id for r in current.recipes}
    for r in body.recipes:
        if r.id not in existing_recipe_ids:
            db.add(_recipe_row(user.id, r))

    await db.flush()
    return await _load_all(db, user.id)
