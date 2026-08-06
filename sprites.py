"""Pixel-sprites bygget i kode fra ASCII-kart.

Ingen bildefiler å holde styr på, og du kan redigere en fiende ved å skrive
om noen bokstaver. Vil du bytte til ekte PNG-er senere, er det bare
`get()` som må endres.
"""
from __future__ import annotations

import pygame

PALETTE = {
    ".": None,
    " ": None,
    "k": (12, 10, 16),        # kontur
    "d": (38, 34, 48),        # mørk
    "g": (88, 82, 98),        # grå
    "w": (216, 212, 202),     # blek
    "r": (150, 40, 48),       # blod
    "R": (222, 86, 72),       # sterk rød
    "f": (240, 150, 60),      # ild
    "F": (255, 214, 130),     # ild lys
    "y": (238, 208, 110),     # gull
    "b": (62, 104, 168),      # blå
    "c": (126, 206, 224),     # frost
    "p": (110, 66, 150),      # lilla
    "P": (188, 128, 226),     # lilla lys
    "m": (54, 128, 84),       # grønn
    "n": (118, 200, 122),     # grønn lys
    "o": (122, 76, 48),       # brun
    "s": (58, 50, 42),        # mørk brun
    "e": (26, 22, 34),        # tomrom
}

ART: dict[str, list[str]] = {
    # ---- spiller -------------------------------------------------------
    "player": [
        "...kkk...",
        "..kwwwk..",
        "..kwgwk..",
        "..kwwwk..",
        ".kdrrrdk.",
        "kddrrrddk",
        "kdd.r.ddk",
        ".k..r..k.",
        "..kd.dk..",
        "..k...k..",
    ],
    # ---- fiender -------------------------------------------------------
    "grunt": [
        ".kkk.",
        "kgRgk",
        "kgggk",
        ".kgk.",
        ".k.k.",
    ],
    "runner": [
        "..kk...",
        ".kRRk..",
        "kggggk.",
        ".k..kk.",
        ".k...k.",
    ],
    "brute": [
        "..kkkkk..",
        ".koooook.",
        "kosRRsook",
        "koooooook",
        "kosssssok",
        ".koooook.",
        ".ko...ok.",
        ".k.....k.",
    ],
    "spitter": [
        "..kkk..",
        ".kmmmk.",
        "kmnnnmk",
        "kmmnmmk",
        ".kmmmk.",
        "..k.k..",
    ],
    "wretch": [
        "..kkkk..",
        ".kpPPpk.",
        "kpPeePpk",
        "kppPPppk",
        ".kpppk k",
        "..k..k..",
        ".k....k.",
    ],
    "phantom": [
        "..cc c..",
        ".cwwwc..",
        "cwe ewc.",
        "cwwwwwc.",
        ".cwwwc..",
        "..c.c...",
    ],
    # ---- bosser --------------------------------------------------------
    "boss_maw": [
        "....kkkkkk....",
        "..kkrrrrrrkk..",
        ".krrRRRRRRrrk.",
        "krrRwwwwwwRrrk",
        "krRwkwkwkwkwRk",
        "krRwwwwwwwwwRk",
        "krrRwkwkwkwRrk",
        ".krrRRRRRRrrk.",
        "..kkrrrrrrkk..",
        "....kkkkkk....",
    ],
    "boss_crawler": [
        "...kkkkkkk....",
        "..kssoooosk...",
        ".ksoRRRRRosk..",
        "ksooRwwwRoosk.",
        "ksoRwkkkwRosk.",
        "ksooRwwwRoosk.",
        ".ksoRRRRRosk..",
        "kk.ksooosk.kk.",
        "k...kkkkk...k.",
    ],
    "boss_eye": [
        "....kkkkkk....",
        "..kkppPPppkk..",
        ".kpPPwwwwPPpk.",
        "kpPwwwwwwwwPpk",
        "kpPwwkkkkwwPpk",
        "kpPwwkeekwwPpk",
        "kpPwwkkkkwwPpk",
        "kpPwwwwwwwwPpk",
        ".kpPPwwwwPPpk.",
        "..kkppPPppkk..",
        "....kkkkkk....",
    ],
    # ---- prosjektiler --------------------------------------------------
    "bullet": [
        ".y.",
        "yFy",
        ".y.",
    ],
    "ember": [
        ".f.",
        "fFf",
        ".f.",
    ],
    "shard": [
        "kw.",
        ".wk",
    ],
    "spawn": [
        ".P.",
        "PeP",
        ".P.",
    ],
    "eshot": [
        ".m.",
        "mnm",
        ".m.",
    ],
    # ---- pickups -------------------------------------------------------
    "xp": [
        ".c.",
        "ccc",
        ".c.",
    ],
    "xp_big": [
        ".cc.",
        "cbbc",
        "cbbc",
        ".cc.",
    ],
    "heal": [
        ".n.",
        "nnn",
        ".n.",
    ],
    # ---- item-ikoner ---------------------------------------------------
    "item_weapon": [
        "..y.",
        ".yy.",
        "yy..",
        "y...",
    ],
    "item_lens": [
        ".ccc.",
        "cwwwc",
        "cwkwc",
        ".ccc.",
    ],
    "item_heart": [
        ".r.r.",
        "rRrRr",
        "rRRRr",
        ".rRr.",
        "..r..",
    ],
    "item_coal": [
        ".ff.",
        "fFFf",
        "fFFf",
        ".ff.",
    ],
    "item_talisman": [
        ".yyy.",
        "ywpwy",
        "ywwwy",
        ".yyy.",
    ],
    "item_boots": [
        "os...",
        "os...",
        "ossso",
        "ooooo",
    ],
    "item_armor": [
        "ggggg",
        "gwwwg",
        "gwwwg",
        ".ggg.",
        "..g..",
    ],
    "item_blast": [
        ".r.r.",
        "rRRRr",
        ".RRR.",
        "rRRRr",
        ".r.r.",
    ],
    "item_freeze": [
        "c.c.c",
        ".ccc.",
        "ccccc",
        ".ccc.",
        "c.c.c",
    ],
    "item_heal": [
        ".nnn.",
        "nwwwn",
        "nwnwn",
        ".nnn.",
    ],
}

_cache: dict[str, pygame.Surface] = {}


def _build(art: list[str]) -> pygame.Surface:
    w = max(len(r) for r in art)
    h = len(art)
    surf = pygame.Surface((w, h), pygame.SRCALPHA)
    for y, row in enumerate(art):
        for x, ch in enumerate(row):
            col = PALETTE.get(ch)
            if col:
                surf.set_at((x, y), col)
    return surf


def get(name: str) -> pygame.Surface:
    s = _cache.get(name)
    if s is None:
        s = _build(ART.get(name, ART["grunt"]))
        _cache[name] = s
    return s


def tinted(name: str, color: tuple[int, int, int]) -> pygame.Surface:
    """Hvit blitz brukt når en fiende blir truffet."""
    key = f"{name}#{color}"
    s = _cache.get(key)
    if s is None:
        base = get(name).copy()
        base.fill((*color, 0), special_flags=pygame.BLEND_RGB_MAX)
        s = base
        _cache[key] = s
    return s
