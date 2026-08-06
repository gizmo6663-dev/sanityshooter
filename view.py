"""Tegner verden i virtuell oppløsning. Alt her er ren presentasjon."""
from __future__ import annotations

import math
import random

import pygame

from ..core import config as C
from . import sprites


class Camera:
    def __init__(self):
        self.x = 0.0
        self.y = 0.0

    def follow(self, world, dt):
        p = world.player
        tx = p.x - C.VW / 2
        ty = p.y - C.VH / 2
        # myk følging
        self.x += (tx - self.x) * min(1.0, dt * 9)
        self.y += (ty - self.y) * min(1.0, dt * 9)
        self.x = max(0, min(C.ARENA_W - C.VW, self.x))
        self.y = max(0, min(C.ARENA_H - C.VH, self.y))
        if world.shake > 0.1:
            self.x += random.uniform(-world.shake, world.shake) * 0.5
            self.y += random.uniform(-world.shake, world.shake) * 0.5
        if p.sanity_frac < C.SANITY_CRITICAL:
            k = (C.SANITY_CRITICAL - p.sanity_frac) / C.SANITY_CRITICAL
            self.x += math.sin(world.time * 7.3) * 3.0 * k
            self.y += math.cos(world.time * 5.1) * 2.0 * k

    def to_screen(self, x, y) -> tuple[int, int]:
        return int(x - self.x), int(y - self.y)


def draw_floor(surf, world, cam):
    tint = world.stage["tint"]
    surf.fill(tint)
    light = tuple(min(255, c + 8) for c in tint)
    cell = 32
    ox = int(-cam.x) % cell
    oy = int(-cam.y) % cell
    for gx in range(-1, C.VW // cell + 2):
        for gy in range(-1, C.VH // cell + 2):
            if (gx + int(cam.x // cell) + gy + int(cam.y // cell)) % 2 == 0:
                surf.fill(light, (gx * cell + ox, gy * cell + oy, cell, cell))
    # arenakant
    edge = (70, 64, 84)
    sx, sy = cam.to_screen(0, 0)
    ex, ey = cam.to_screen(C.ARENA_W, C.ARENA_H)
    pygame.draw.rect(surf, edge, pygame.Rect(sx, sy, ex - sx, ey - sy), 2)


def blit_center(surf, img, sx, sy):
    surf.blit(img, (sx - img.get_width() // 2, sy - img.get_height() // 2))


def draw_world(surf, world, cam):
    p = world.player

    draw_floor(surf, world, cam)

    # pickups
    for it in world.pickups:
        sx, sy = cam.to_screen(it.x, it.y)
        if it.kind == "xp":
            name = "xp_big" if it.value >= 3 else "xp"
        elif it.kind == "heal":
            name = "heal"
        else:
            name = it.payload.get("sprite", "item_weapon")
        bob = math.sin(it.age * 5) * 1.0
        blit_center(surf, sprites.get(name), sx, int(sy + bob))

    # fiender
    for e in world.enemies:
        sx, sy = cam.to_screen(e.x, e.y)
        if sx < -30 or sx > C.VW + 30 or sy < -30 or sy > C.VH + 30:
            continue
        name = e.data["sprite"]
        if e.flash > 0:
            img = sprites.tinted(name, (255, 255, 255))
        elif "chill" in e.statuses:
            img = sprites.tinted(name, (150, 220, 255))
        elif "burn" in e.statuses:
            img = sprites.tinted(name, (255, 180, 110))
        elif "corrupt" in e.statuses:
            img = sprites.tinted(name, (200, 130, 255))
        else:
            img = sprites.get(name)
        if e.is_phantom:
            img = img.copy()
            img.set_alpha(150)
        blit_center(surf, img, sx, sy)
        if e.is_elite and not e.is_boss:
            pygame.draw.rect(surf, (200, 60, 60),
                             (sx - 7, sy - e.radius - 6, 14, 2))
            pygame.draw.rect(surf, (90, 220, 110),
                             (sx - 7, sy - e.radius - 6,
                              int(14 * max(0, e.hp / e.max_hp)), 2))

    # spiller
    psx, psy = cam.to_screen(p.x, p.y)
    pimg = sprites.get("player")
    if p.iframes > 0 and int(p.iframes * 30) % 2 == 0:
        pimg = sprites.tinted("player", (255, 255, 255))
    blit_center(surf, pimg, psx, psy)

    # prosjektiler
    for pr in world.projectiles:
        if not pr.sprite:
            continue
        sx, sy = cam.to_screen(pr.x, pr.y)
        blit_center(surf, sprites.get(pr.sprite), sx, sy)
    for pr in world.enemy_shots:
        sx, sy = cam.to_screen(pr.x, pr.y)
        blit_center(surf, sprites.get("eshot"), sx, sy)

    draw_effects(surf, world, cam)

    # flytende tall
    for f in world.floaters:
        sx, sy = cam.to_screen(f.x, f.y)
        _tiny_text(surf, f.text, sx, sy, f.color, int(255 * (1 - f.age / f.life)))

    if p.sanity_frac < C.SANITY_CRITICAL:
        k = (C.SANITY_CRITICAL - p.sanity_frac) / C.SANITY_CRITICAL
        veil = pygame.Surface((C.VW, C.VH), pygame.SRCALPHA)
        veil.fill((90, 30, 130, int(70 * k)))
        surf.blit(veil, (0, 0))


def draw_effects(surf, world, cam):
    for e in world.effects:
        t = e.age / e.life
        sx, sy = cam.to_screen(e.x, e.y)
        if e.kind == "aura":
            pygame.draw.circle(surf, (120, 200, 235), (sx, sy),
                               int(e.radius * (0.9 + 0.1 * t)), 1)
        elif e.kind in ("blast", "corrupt_blast"):
            col = (240, 140, 90) if e.kind == "blast" else (190, 110, 240)
            pygame.draw.circle(surf, col, (sx, sy), int(e.radius * (0.4 + t)), 2)
        elif e.kind == "beam":
            ex, ey = cam.to_screen(e.x2, e.y2)
            w = max(1, int(4 * (1 - t)))
            pygame.draw.line(surf, (170, 110, 230), (sx, sy), (ex, ey), w)
            pygame.draw.line(surf, (240, 220, 255), (sx, sy), (ex, ey), 1)
        elif e.kind == "shock":
            pygame.draw.circle(surf, (255, 230, 160), (sx, sy),
                               int(e.radius * (0.3 + t)), 1)
        elif e.kind == "blink":
            pygame.draw.circle(surf, (140, 220, 240), (sx, sy),
                               int(e.radius * (1 - t)), 1)
        elif e.kind == "freeze":
            pygame.draw.circle(surf, (170, 230, 255), (sx, sy),
                               int(e.radius * t), 1)
        elif e.kind == "poof":
            pygame.draw.circle(surf, (200, 220, 240), (sx, sy),
                               int(6 * (1 - t)), 1)


_font_cache = {}


def _tiny_text(surf, text, x, y, color, alpha):
    key = (text, color)
    img = _font_cache.get(key)
    if img is None:
        f = pygame.font.Font(None, 11)
        img = f.render(text, False, color)
        _font_cache[key] = img
        if len(_font_cache) > 400:
            _font_cache.clear()
    img = img.copy()
    img.set_alpha(max(0, min(255, alpha)))
    surf.blit(img, (x - img.get_width() // 2, y - img.get_height() // 2))
