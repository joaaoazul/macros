"""Análise de refeições por IA — proxy para a Anthropic com a chave do próprio utilizador.

A chave (BYOK) viaja no body sobre TLS, é usada uma vez e nunca é guardada nem logada.
"""

import json
import time
from collections import defaultdict
from typing import ClassVar

import anthropic
from fastapi import APIRouter, Depends, HTTPException

from app.ai.schemas import (
    AnalyzeMealRequest,
    AnalyzeMealResponse,
    FoodTipsRequest,
    FoodTipsResponse,
)
from app.auth.dependencies import get_current_user
from app.auth.models import User

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

MODEL = "claude-opus-4-8"
MAX_TOKENS = 2000
TIMEOUT_SECONDS = 60.0

FOODS_SCHEMA = {
    "type": "object",
    "properties": {
        "foods": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "emoji": {"type": "string"},
                    "grams": {"type": "number"},
                    "unit": {"type": "string", "enum": ["g", "ml"]},
                    "kcal": {"type": "number"},
                    "protein": {"type": "number"},
                    "carbs": {"type": "number"},
                    "fat": {"type": "number"},
                },
                "required": ["name", "emoji", "grams", "unit", "kcal", "protein", "carbs", "fat"],
                "additionalProperties": False,
            },
        },
        "notes": {"type": "string"},
    },
    "required": ["foods"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = (
    "És um nutricionista que analisa refeições. Identifica cada alimento presente, "
    "estima a porção em gramas (ou ml para líquidos) e as macros ABSOLUTAS dessa porção "
    "(não por 100g): kcal, proteína, hidratos de carbono e gordura, em gramas. "
    "Usa nomes em português de Portugal e um emoji adequado por alimento. "
    "Se algo for incerto, faz a melhor estimativa e menciona-o em notes."
)


class _UserRateLimiter:
    """Rate limit in-memory por utilizador (o _RateLimiter de auth é por IP)."""

    _buckets: ClassVar[dict[int, list[float]]] = defaultdict(list)

    def __init__(self, max_calls: int, window_seconds: int) -> None:
        self.max_calls = max_calls
        self.window = window_seconds

    def check(self, user_id: int) -> None:
        now = time.monotonic()
        cutoff = now - self.window
        self._buckets[user_id] = [t for t in self._buckets[user_id] if t > cutoff]
        if len(self._buckets[user_id]) >= self.max_calls:
            raise HTTPException(
                status_code=429,
                detail="Demasiados pedidos de análise. Aguarda um minuto.",
                headers={"Retry-After": str(self.window)},
            )
        self._buckets[user_id].append(now)


ai_rate_limit = _UserRateLimiter(max_calls=10, window_seconds=60)


@router.post("/analyze-meal", response_model=AnalyzeMealResponse)
async def analyze_meal(
    body: AnalyzeMealRequest,
    user: User = Depends(get_current_user),
) -> AnalyzeMealResponse:
    ai_rate_limit.check(user.id)

    content: list[dict] = []
    if body.imageBase64:
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": body.imageBase64,
                },
            }
        )
    prompt = "Analisa esta refeição e devolve os alimentos com macros."
    if body.description and body.description.strip():
        prompt += f"\n\nDescrição do utilizador: {body.description.strip()}"
    content.append({"type": "text", "text": prompt})

    client = anthropic.AsyncAnthropic(api_key=body.apiKey, timeout=TIMEOUT_SECONDS, max_retries=0)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            output_config={"format": {"type": "json_schema", "schema": FOODS_SCHEMA}},
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Chave Anthropic inválida.")
    except anthropic.RateLimitError:
        raise HTTPException(
            status_code=429, detail="Limite da Anthropic atingido. Tenta daqui a pouco."
        )
    except anthropic.APIStatusError:
        raise HTTPException(status_code=502, detail="A análise falhou. Tenta novamente.")
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=502, detail="Sem ligação à Anthropic. Tenta novamente.")
    finally:
        await client.close()

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise HTTPException(status_code=502, detail="A análise não devolveu resultados.")
    try:
        data = json.loads(text)
    except ValueError:
        raise HTTPException(status_code=502, detail="A análise devolveu um formato inesperado.")
    return AnalyzeMealResponse(**data)


TIPS_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "uses": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
        "pairs_with": {"type": "array", "items": {"type": "string"}, "maxItems": 6},
    },
    "required": ["summary", "uses", "pairs_with"],
    "additionalProperties": False,
}

TIPS_SYSTEM_PROMPT = (
    "És um nutricionista prático português. Dado um alimento e as suas macros por 100 g/ml, "
    "escreve: 'summary' (1 frase sobre o perfil nutricional e para que serve), "
    "'uses' (3 a 5 ideias curtas e concretas de como usar o alimento no dia-a-dia em Portugal), "
    "e 'pairs_with' (3 a 6 alimentos que combinam bem). Português de Portugal, tom simples e útil, "
    "frases curtas. Não inventes valores nutricionais."
)


@router.post("/food-tips", response_model=FoodTipsResponse)
async def food_tips(
    body: FoodTipsRequest,
    user: User = Depends(get_current_user),
) -> FoodTipsResponse:
    ai_rate_limit.check(user.id)

    name = f"{body.name}" + (f" ({body.brand})" if body.brand else "")
    prompt = (
        f"Alimento: {name}\n"
        f"Por 100 {body.unit}: {body.kcal:.0f} kcal, {body.protein:.1f} g proteína, "
        f"{body.carbs:.1f} g hidratos, {body.fat:.1f} g gordura.\n"
        "Dá sugestões de utilização."
    )

    client = anthropic.AsyncAnthropic(api_key=body.apiKey, timeout=TIMEOUT_SECONDS, max_retries=0)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=1000,
            system=TIPS_SYSTEM_PROMPT,
            output_config={"format": {"type": "json_schema", "schema": TIPS_SCHEMA}},
            messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Chave Anthropic inválida.")
    except anthropic.RateLimitError:
        raise HTTPException(
            status_code=429, detail="Limite da Anthropic atingido. Tenta daqui a pouco."
        )
    except (anthropic.APIStatusError, anthropic.APIConnectionError):
        raise HTTPException(status_code=502, detail="Não foi possível obter sugestões. Tenta novamente.")
    finally:
        await client.close()

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise HTTPException(status_code=502, detail="Sem sugestões.")
    try:
        data = json.loads(text)
    except ValueError:
        raise HTTPException(status_code=502, detail="Formato inesperado.")
    return FoodTipsResponse(**data)
