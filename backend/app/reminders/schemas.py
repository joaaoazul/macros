"""Schemas dos lembretes."""

import re

from pydantic import BaseModel, Field, field_validator

_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_KINDS = {"water", "weigh_in", "breakfast", "lunch", "dinner"}


class ReminderOut(BaseModel):
    kind: str
    hhmm: str
    enabled: bool


class ReminderUpdate(BaseModel):
    kind: str = Field(max_length=20)
    hhmm: str = Field(max_length=5)
    enabled: bool

    @field_validator("kind")
    @classmethod
    def _valid_kind(cls, v: str) -> str:
        if v not in _KINDS:
            raise ValueError("kind inválido")
        return v

    @field_validator("hhmm")
    @classmethod
    def _valid_time(cls, v: str) -> str:
        if not _HHMM.match(v):
            raise ValueError("hora inválida (HH:MM)")
        return v
