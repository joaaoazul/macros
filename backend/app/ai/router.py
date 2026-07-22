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
    AnalyzePantryRequest,
    AnalyzePantryResponse,
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


def _buffet_schema() -> dict:
    """FOODS_SCHEMA com kcalMin/kcalMax obrigatórios (modo buffet)."""
    schema = json.loads(json.dumps(FOODS_SCHEMA))  # cópia profunda: o base é partilhado
    item = schema["properties"]["foods"]["items"]
    item["properties"]["kcalMin"] = {"type": "number"}
    item["properties"]["kcalMax"] = {"type": "number"}
    item["required"] = [*item["required"], "kcalMin", "kcalMax"]
    return schema


BUFFET_SCHEMA = _buffet_schema()

SYSTEM_PROMPT = (
    "És um nutricionista que analisa refeições. Identifica cada alimento presente, "
    "estima a porção em gramas (ou ml para líquidos) e as macros ABSOLUTAS dessa porção "
    "(não por 100g): kcal, proteína, hidratos de carbono e gordura, em gramas. "
    "Usa nomes em português de Portugal e um emoji adequado por alimento. "
    "Se algo for incerto, faz a melhor estimativa e menciona-o em notes."
)

BUFFET_SYSTEM_PROMPT = (
    "És um nutricionista a estimar um prato de buffet/self-service, onde não há "
    "embalagem nem peças contáveis e o molho e o óleo são invisíveis. Identifica cada "
    "componente do prato e, para cada um, dá um INTERVALO honesto de calorias: "
    "'kcalMin' e 'kcalMax' são os extremos plausíveis e 'kcal' é o ponto médio. "
    "As macros (proteína, hidratos, gordura) correspondem ao ponto médio. "
    "NÃO finjas precisão: se o prato tiver molho, fritura ou fontes de gordura que não "
    "consegues ver, o intervalo tem de ser largo o suficiente para as incluir. "
    "Usa nomes em português de Portugal e um emoji por componente. "
    "Em 'notes', diz numa frase o que mais influencia o intervalo (ex.: o molho)."
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
    buffet = body.mode == "buffet"
    prompt = (
        "Estima este prato de buffet e devolve cada componente com o intervalo de calorias."
        if buffet
        else "Analisa esta refeição e devolve os alimentos com macros."
    )
    if body.description and body.description.strip():
        prompt += f"\n\nDescrição do utilizador: {body.description.strip()}"
    content.append({"type": "text", "text": prompt})

    client = anthropic.AsyncAnthropic(api_key=body.apiKey, timeout=TIMEOUT_SECONDS, max_retries=0)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            thinking={"type": "adaptive"},
            system=BUFFET_SYSTEM_PROMPT if buffet else SYSTEM_PROMPT,
            output_config={
                "format": {
                    "type": "json_schema",
                    "schema": BUFFET_SCHEMA if buffet else FOODS_SCHEMA,
                }
            },
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


PANTRY_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "emoji": {"type": "string"},
                    "qty": {"type": "integer"},
                    "shelfLifeDays": {"type": "integer"},
                },
                "required": ["name", "emoji", "qty", "shelfLifeDays"],
                "additionalProperties": False,
            },
        },
        "notes": {"type": "string"},
    },
    "required": ["items"],
    "additionalProperties": False,
}

PANTRY_SYSTEM_PROMPT = (
    "Vês uma foto de um frigorífico, congelador ou despensa. Lista os alimentos que "
    "consegues identificar com confiança, para entrarem num inventário de casa. "
    "Para cada um: 'name' curto em português de Portugal (o alimento, não a marca, "
    "salvo se a marca for o que se lê), 'emoji' adequado, 'qty' as unidades/embalagens "
    "que vês, e 'shelfLifeDays' os dias que costuma durar a partir de hoje bem "
    "conservado (peixe fresco 2, frango 2, carne 4, leite aberto 7, iogurte 14, "
    "ovos 28, queijo curado 21, fruta e legumes 4 a 21, enlatados e secos 365+). "
    "NÃO inventes o que não consegues ver: se estiver tapado ou ilegível, deixa de fora. "
    "Ignora temperos, condimentos e coisas que nunca acabam. "
    "Em 'notes', diz numa frase se ficou algo por identificar."
)


@router.post("/analyze-pantry", response_model=AnalyzePantryResponse)
async def analyze_pantry(
    body: AnalyzePantryRequest,
    user: User = Depends(get_current_user),
) -> AnalyzePantryResponse:
    ai_rate_limit.check(user.id)

    client = anthropic.AsyncAnthropic(api_key=body.apiKey, timeout=TIMEOUT_SECONDS, max_retries=0)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            thinking={"type": "adaptive"},
            system=PANTRY_SYSTEM_PROMPT,
            output_config={"format": {"type": "json_schema", "schema": PANTRY_SCHEMA}},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": body.imageBase64,
                            },
                        },
                        {"type": "text", "text": "O que está aqui guardado?"},
                    ],
                }
            ],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Chave Anthropic inválida.")
    except anthropic.RateLimitError:
        raise HTTPException(
            status_code=429, detail="Limite da Anthropic atingido. Tenta daqui a pouco."
        )
    except (anthropic.APIStatusError, anthropic.APIConnectionError):
        raise HTTPException(status_code=502, detail="A análise falhou. Tenta novamente.")
    finally:
        await client.close()

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise HTTPException(status_code=502, detail="A análise não devolveu resultados.")
    try:
        data = json.loads(text)
    except ValueError:
        raise HTTPException(status_code=502, detail="A análise devolveu um formato inesperado.")
    return AnalyzePantryResponse(**data)


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
