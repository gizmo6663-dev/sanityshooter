"""HUD, on-screen-kontroller og overlegg. Alt tegnes i virtuell oppløsning."""
from __future__ import annotations

import math

import pygame

from ..core import config as C
from ..core import content as K

# Kontrollgeometri i virtuelle piksler
STICK_BASE = (58, C.VH - 56)
STICK_RADIUS = 34
KNOB_RADIUS = 13
DODGE_BTN = (C.VW - 44, C.VH - 44)
DODGE_R = 20
ACTIVE_BTN = (C.VW - 46, C.VH - 92)
ACTIVE_R = 16
PAUSE_BTN = (C.VW - 12, 10)

COL_BG_PANEL = (14, 12, 20)
COL_HP = (198, 58, 58)
COL_HP_BG = (54, 24, 28)
COL_SAN = (140, 92, 200)
COL_SAN_BG = (34, 26, 50)
COL_XP = (110, 200, 224)
COL_TEXT = (226, 224, 216)
COL_DIM = (140, 136, 132)


class Fonts:
    def __init__(self):
        pygame.font.init()
        self.small = pygame.font.Font(None, 11)
        self.med = pygame.font.Font(None, 14)
        self.big = pygame.font.Font(None, 22)

    def draw(self, surf, font, text, pos, color=COL_TEXT, center=False):
        img = font.render(text, False, color)
        r = img.get_rect()
        if center:
            r.center = pos
        else:
            r.topleft = pos
        surf.blit(img, r)
        return r


def bar(surf, x, y, w, h, frac, col, bg):
    pygame.draw.rect(surf, bg, (x, y, w, h))
    frac = max(0.0, min(1.0, frac))
    if frac > 0:
        pygame.draw.rect(surf, col, (x, y, max(1, int(w * frac)), h))
    pygame.draw.rect(surf, (8, 6, 12), (x, y, w, h), 1)


# =========================================================================
# HUD
# =========================================================================
def draw_hud(surf, world, fonts: Fonts, stick):
    p = world.player

    # XP-stripe langs toppen
    bar(surf, 0, 0, C.VW, 4, p.xp / max(1, p.xp_need), COL_XP, (20, 30, 38))

    # HP og SAN
    bar(surf, 6, 8, 92, 7, p.hp / p.max_hp, COL_HP, COL_HP_BG)
    fonts.draw(surf, fonts.small, f"{int(p.hp)}/{int(p.max_hp)}", (102, 8), COL_DIM)
    bar(surf, 6, 18, 92, 5, p.sanity_frac, COL_SAN, COL_SAN_BG)
    san_txt = f"SAN {int(p.sanity)}"
    if p.madness_bonus > 0.02:
        san_txt += f"  +{int(p.madness_bonus * 100)}% skade"
    fonts.draw(surf, fonts.small, san_txt, (102, 18),
               (200, 150, 240) if p.sanity_frac < C.SANITY_LOW else COL_DIM)

    # Bane / nivå
    fonts.draw(surf, fonts.small, world.stage["name"], (6, 28), COL_DIM)
    fonts.draw(surf, fonts.small, f"Nv {p.level}   Drap {world.kills}",
               (6, 38), COL_DIM)

    # Våpenliste
    y = 52
    for w in p.weapons:
        fonts.draw(surf, fonts.small, f"{w.name} {w.level}", (6, y), (170, 168, 160))
        y += 9

    # Boss-helse
    boss = next((e for e in world.enemies if e.is_boss), None)
    if boss:
        bar(surf, 90, C.VH - 14, C.VW - 180, 6, boss.hp / boss.max_hp,
            (190, 50, 70), (40, 16, 22))
        fonts.draw(surf, fonts.small, boss.data["name"],
                   (C.VW // 2, C.VH - 22), (230, 150, 160), center=True)

    draw_controls(surf, world, fonts, stick)


def draw_controls(surf, world, fonts: Fonts, stick):
    p = world.player
    # Joystick
    bx, by = stick["base"] if stick["active"] else STICK_BASE
    pygame.draw.circle(surf, (40, 38, 52), (int(bx), int(by)), STICK_RADIUS, 1)
    kx = bx + stick["dx"] * STICK_RADIUS * 0.7
    ky = by + stick["dy"] * STICK_RADIUS * 0.7
    pygame.draw.circle(surf, (86, 82, 104), (int(kx), int(ky)), KNOB_RADIUS)
    pygame.draw.circle(surf, (20, 18, 28), (int(kx), int(ky)), KNOB_RADIUS, 1)

    # Dodge
    ready = p.dodge_timer <= 0
    col = (120, 200, 224) if ready else (54, 60, 70)
    pygame.draw.circle(surf, (24, 24, 34), DODGE_BTN, DODGE_R)
    pygame.draw.circle(surf, col, DODGE_BTN, DODGE_R, 2)
    label = "BLINK" if p.blink else "UNNA"
    fonts.draw(surf, fonts.small, label, DODGE_BTN, col, center=True)
    if not ready:
        frac = 1.0 - p.dodge_timer / max(0.01, p.stats.get("dodge_cooldown"))
        _arc(surf, DODGE_BTN, DODGE_R - 4, frac, (90, 140, 170))

    # Aktivt item
    if p.active_item:
        d = K.ITEMS[p.active_item]
        ok = p.active_cd <= 0
        c2 = (230, 190, 110) if ok else (60, 56, 48)
        pygame.draw.circle(surf, (24, 24, 34), ACTIVE_BTN, ACTIVE_R)
        pygame.draw.circle(surf, c2, ACTIVE_BTN, ACTIVE_R, 2)
        fonts.draw(surf, fonts.small, d["name"][:6], ACTIVE_BTN, c2, center=True)
        if not ok:
            _arc(surf, ACTIVE_BTN, ACTIVE_R - 4,
                 1.0 - p.active_cd / d["cooldown"], (150, 120, 70))

    # Pause
    pygame.draw.rect(surf, (150, 148, 142), (PAUSE_BTN[0] - 3, PAUSE_BTN[1] - 4, 2, 9))
    pygame.draw.rect(surf, (150, 148, 142), (PAUSE_BTN[0] + 1, PAUSE_BTN[1] - 4, 2, 9))


def _arc(surf, center, radius, frac, color):
    steps = max(2, int(28 * frac))
    pts = [center]
    for i in range(steps + 1):
        a = -math.pi / 2 + math.tau * frac * i / steps
        pts.append((center[0] + math.cos(a) * radius,
                    center[1] + math.sin(a) * radius))
    if len(pts) > 2:
        pygame.draw.polygon(surf, color, pts, 1)


# =========================================================================
# Overlegg
# =========================================================================
def perk_cards(count: int) -> list[pygame.Rect]:
    h = 34
    gap = 6
    total = count * h + (count - 1) * gap
    top = (C.VH - total) // 2 + 12
    return [pygame.Rect(46, top + i * (h + gap), C.VW - 92, h) for i in range(count)]


def draw_levelup(surf, world, fonts: Fonts):
    _dim(surf, 190)
    fonts.draw(surf, fonts.big, "NIVÅ " + str(world.player.level),
               (C.VW // 2, 26), (235, 232, 220), center=True)
    rects = perk_cards(len(world.pending_perks))
    for perk, r in zip(world.pending_perks, rects):
        forb = perk.forbidden
        border = (196, 92, 220) if forb else (110, 200, 224)
        pygame.draw.rect(surf, (20, 16, 28) if forb else (16, 20, 26), r)
        pygame.draw.rect(surf, border, r, 1)
        fonts.draw(surf, fonts.med, perk.name, (r.x + 8, r.y + 6),
                   (232, 180, 250) if forb else (232, 232, 226))
        fonts.draw(surf, fonts.small, perk.desc, (r.x + 8, r.y + 20), COL_DIM)
        if forb:
            fonts.draw(surf, fonts.small, "FORBUDT", (r.right - 44, r.y + 6),
                       (208, 110, 230))


def draw_stage_clear(surf, world, fonts: Fonts):
    _dim(surf, 200)
    fonts.draw(surf, fonts.big, "BANEN ER STILLE", (C.VW // 2, 90),
               (235, 232, 220), center=True)
    fonts.draw(surf, fonts.med, f"Drap: {world.kills}   Nivå: {world.player.level}",
               (C.VW // 2, 120), COL_DIM, center=True)
    fonts.draw(surf, fonts.med, "Trykk for å gå videre", (C.VW // 2, 150),
               (150, 210, 230), center=True)


def draw_dead(surf, world, fonts: Fonts):
    _dim(surf, 215)
    fonts.draw(surf, fonts.big, "DU ER BORTE", (C.VW // 2, 88), (220, 90, 90),
               center=True)
    fonts.draw(surf, fonts.med,
               f"Overlevde {int(world.time)} s  ·  {world.kills} drap  ·  nivå {world.player.level}",
               (C.VW // 2, 118), COL_DIM, center=True)
    fonts.draw(surf, fonts.med, "Trykk for å begynne på nytt", (C.VW // 2, 148),
               (200, 200, 200), center=True)


def draw_paused(surf, world, fonts: Fonts):
    _dim(surf, 180)
    fonts.draw(surf, fonts.big, "PAUSE", (C.VW // 2, 100), COL_TEXT, center=True)
    p = world.player
    lines = [
        f"Skade x{p.stats.get('damage_mult'):.2f}   Fart x{p.stats.get('fire_rate_mult'):.2f}",
        f"Rekkevidde x{p.stats.get('range_mult'):.2f}   Luck {p.stats.get('luck'):.0f}",
        f"Rustning {p.stats.get('armor'):.0f}   Krit {p.stats.get('crit_chance') * 100:.0f}%",
    ]
    for i, t in enumerate(lines):
        fonts.draw(surf, fonts.small, t, (C.VW // 2, 128 + i * 12), COL_DIM, center=True)
    items = ", ".join(K.ITEMS[i]["name"] for i in p.items) or "ingen"
    fonts.draw(surf, fonts.small, "Gjenstander: " + items, (C.VW // 2, 172),
               COL_DIM, center=True)
    fonts.draw(surf, fonts.med, "Trykk for å fortsette", (C.VW // 2, 196),
               (150, 210, 230), center=True)


def _dim(surf, alpha):
    veil = pygame.Surface((C.VW, C.VH), pygame.SRCALPHA)
    veil.fill((6, 5, 10, alpha))
    surf.blit(veil, (0, 0))
