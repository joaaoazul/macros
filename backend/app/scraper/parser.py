"""Extrai info nutricional de uma página via JSON-LD (schema.org), stdlib apenas.

Estratégia: procurar blocos <script type="application/ld+json">, achatar @graph e
apanhar um Recipe ou Product com NutritionInformation. As macros do schema.org são
por dose; se soubermos os gramas da dose convertemos para por-100g (contrato do
tipo Food) e guardamos a dose como porção caseira. Sem dose em gramas → devolvemos
só nome/emoji para o utilizador preencher as macros à mão.
"""

import json
import re

_JSONLD_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
_OG_TITLE_RE = re.compile(
    r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\']', re.IGNORECASE
)
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_NUM_RE = re.compile(r"(-?\d+(?:[.,]\d+)?)")
_GRAMS_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(g|gram|grams|ml|milliliter|millilitre)\b", re.IGNORECASE)


def _num(value) -> float | None:
    """Primeiro número de uma string ('250 kcal' → 250) ou o próprio número."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = _NUM_RE.search(str(value))
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", "."))
    except ValueError:
        return None


def _serving_grams(value) -> tuple[float, str] | None:
    """Extrai (gramas, unidade) de um servingSize tipo '55 g' ou '1 dose (55g)'."""
    if value is None:
        return None
    m = _GRAMS_RE.search(str(value))
    if not m:
        return None
    grams = float(m.group(1).replace(",", "."))
    if grams <= 0:
        return None
    unit = "ml" if m.group(2).lower().startswith(("ml", "milli")) else "g"
    return grams, unit


def extract_jsonld(html: str) -> list[dict]:
    """Todos os objetos JSON-LD da página, com @graph achatado."""
    objects: list[dict] = []
    for block in _JSONLD_RE.findall(html):
        try:
            data = json.loads(block.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        candidates = data if isinstance(data, list) else [data]
        for obj in candidates:
            if not isinstance(obj, dict):
                continue
            graph = obj.get("@graph")
            if isinstance(graph, list):
                objects.extend(g for g in graph if isinstance(g, dict))
            else:
                objects.append(obj)
    return objects


def _has_type(obj: dict, wanted: str) -> bool:
    t = obj.get("@type")
    if isinstance(t, list):
        return any(str(x).lower() == wanted.lower() for x in t)
    return str(t).lower() == wanted.lower()


def _first_of_type(objects: list[dict], wanted: str) -> dict | None:
    return next((o for o in objects if _has_type(o, wanted)), None)


def _clean(text: str | None) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()[:255]


def _nutrition_food(name: str, nutrition: dict, brand: str | None = None) -> dict | None:
    """Constrói um Food (por 100g) a partir de NutritionInformation por dose."""
    kcal = _num(nutrition.get("calories"))
    protein = _num(nutrition.get("proteinContent"))
    carbs = _num(nutrition.get("carbohydrateContent"))
    fat = _num(nutrition.get("fatContent"))
    if kcal is None and protein is None and carbs is None and fat is None:
        return None

    serving = _serving_grams(nutrition.get("servingSize"))
    unit = "g"
    portions = None
    scale = 1.0
    if serving is not None:
        grams, unit = serving
        scale = 100.0 / grams  # por dose → por 100g/ml
        portions = [{"label": "dose", "grams": round(grams, 1)}]

    def per100(v: float | None) -> float:
        return round((v or 0) * scale, 1)

    food = {
        "name": name,
        "emoji": "🥤" if unit == "ml" else "🍽️",
        "kcal": round((kcal or 0) * scale),
        "protein": per100(protein),
        "carbs": per100(carbs),
        "fat": per100(fat),
        "unit": unit,
        "fiber": per100(_num(nutrition.get("fiberContent"))) or None,
        "sugar": per100(_num(nutrition.get("sugarContent"))) or None,
        "saturates": per100(_num(nutrition.get("saturatedFatContent"))) or None,
        "salt": None,
    }
    if brand:
        food["brand"] = _clean(brand)[:255]
    if portions:
        food["portions"] = portions
    # sódio (mg) → sal (g) aproximado
    sodium_mg = _num(nutrition.get("sodiumContent"))
    if sodium_mg is not None:
        food["salt"] = round(sodium_mg * scale * 2.5 / 1000, 2) or None
    return {k: v for k, v in food.items() if v is not None}


def _brand_name(brand) -> str | None:
    if isinstance(brand, dict):
        return brand.get("name")
    if isinstance(brand, str):
        return brand
    return None


def parse(html: str) -> dict:
    """Devolve {'food': {...}|None, 'name': str, 'source': 'recipe'|'product'|'title'|'none'}."""
    objects = extract_jsonld(html)

    recipe = _first_of_type(objects, "Recipe")
    if recipe is not None:
        name = _clean(recipe.get("name"))
        nutrition = recipe.get("nutrition")
        if name and isinstance(nutrition, dict):
            food = _nutrition_food(name, nutrition)
            if food is not None:
                food["emoji"] = "🍲"
                return {"food": food, "name": name, "source": "recipe"}
        if name:
            return {"food": None, "name": name, "source": "recipe"}

    product = _first_of_type(objects, "Product")
    if product is not None:
        name = _clean(product.get("name"))
        brand = _brand_name(product.get("brand"))
        nutrition = product.get("nutrition")
        if name and isinstance(nutrition, dict):
            food = _nutrition_food(name, nutrition, brand)
            if food is not None:
                return {"food": food, "name": name, "source": "product"}
        if name:
            food = {"name": name, "emoji": "🛒", "kcal": 0, "protein": 0, "carbs": 0, "fat": 0, "unit": "g"}
            if brand:
                food["brand"] = _clean(brand)
            return {"food": food, "name": name, "source": "product"}

    # fallback: og:title ou <title>
    m = _OG_TITLE_RE.search(html) or _TITLE_RE.search(html)
    name = _clean(m.group(1)) if m else ""
    if name:
        return {
            "food": {"name": name, "emoji": "🍽️", "kcal": 0, "protein": 0, "carbs": 0, "fat": 0, "unit": "g"},
            "name": name,
            "source": "title",
        }
    return {"food": None, "name": "", "source": "none"}
