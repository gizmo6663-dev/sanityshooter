"""Statblokk med additive og multiplikative modifikatorer.

Perks, items og rustning legger til modifikatorer her. Alt regnes ut på nytt
ved endring, slik at ingenting kan drifte ut av synk.
"""
from __future__ import annotations

from .config import PLAYER_BASE


class StatBlock:
    def __init__(self, base: dict[str, float] | None = None):
        self.base = dict(base if base is not None else PLAYER_BASE)
        self.flat: dict[str, float] = {}
        self.mult: dict[str, float] = {}
        # Skademultiplikator per skade-tag: fysisk, ild, frost, eldritch, blod
        self.tag_mult: dict[str, float] = {}
        self._cache: dict[str, float] = {}

    # -- modifikasjon ----------------------------------------------------
    def add(self, key: str, value: float) -> None:
        self.flat[key] = self.flat.get(key, 0.0) + value
        self._cache.clear()

    def scale(self, key: str, factor: float) -> None:
        """factor 0.2 = +20 %, -0.15 = -15 %."""
        self.mult[key] = self.mult.get(key, 0.0) + factor
        self._cache.clear()

    def scale_tag(self, tag: str, factor: float) -> None:
        self.tag_mult[tag] = self.tag_mult.get(tag, 0.0) + factor
        self._cache.clear()

    # -- oppslag ---------------------------------------------------------
    def get(self, key: str) -> float:
        if key in self._cache:
            return self._cache[key]
        v = self.base.get(key, 0.0) + self.flat.get(key, 0.0)
        v *= 1.0 + self.mult.get(key, 0.0)
        self._cache[key] = v
        return v

    def tag(self, tag: str) -> float:
        return 1.0 + self.tag_mult.get(tag, 0.0)

    def snapshot(self) -> dict[str, float]:
        return {k: self.get(k) for k in self.base}
