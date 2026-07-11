"""AI meal-analysis schemas — BYOK: a chave Anthropic vem no request, nunca é persistida."""

from pydantic import BaseModel, Field, model_validator

# ~4MB de imagem em base64 (downscaled no cliente para <=1024px JPEG)
MAX_IMAGE_B64_CHARS = 6_000_000


class AnalyzeMealRequest(BaseModel):
    description: str | None = Field(default=None, max_length=2000)
    imageBase64: str | None = Field(default=None, max_length=MAX_IMAGE_B64_CHARS)
    apiKey: str = Field(min_length=20, max_length=512, repr=False)

    @model_validator(mode="after")
    def _require_input(self) -> "AnalyzeMealRequest":
        if not (self.description and self.description.strip()) and not self.imageBase64:
            raise ValueError("Indica uma descrição ou uma foto da refeição.")
        if self.imageBase64 and self.imageBase64.startswith("data:"):
            # remove prefixo data-URL defensivamente
            self.imageBase64 = self.imageBase64.split(",", 1)[-1]
        return self


class AnalyzedFood(BaseModel):
    name: str
    emoji: str
    grams: float
    unit: str
    kcal: float
    protein: float
    carbs: float
    fat: float


class AnalyzeMealResponse(BaseModel):
    foods: list[AnalyzedFood]
    notes: str | None = None
