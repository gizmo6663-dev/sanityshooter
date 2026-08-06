"""VANVIDD — inngangspunkt.

Kjør på PC:      python main.py
Bygg for Android: se README.md
"""
from __future__ import annotations

import math
import sys

import pygame

from vanvidd.core import config as C
from vanvidd.core.world import Input, World
from vanvidd.render import hud, view


class Game:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("VANVIDD")
        flags = pygame.RESIZABLE
        if sys.platform == "android" or "ANDROID_ARGUMENT" in __import__("os").environ:
            flags = pygame.FULLSCREEN
            self.screen = pygame.display.set_mode((0, 0), flags)
        else:
            self.screen = pygame.display.set_mode((C.VW * 3, C.VH * 3), flags)
        self.canvas = pygame.Surface((C.VW, C.VH))
        self.clock = pygame.time.Clock()
        self.fonts = hud.Fonts()
        self.cam = view.Camera()
        self.world = World()
        self.running = True

        # Berøringstilstand
        self.stick = {"active": False, "fid": None, "base": hud.STICK_BASE,
                      "dx": 0.0, "dy": 0.0}
        self.dodge_fid = None
        self.active_fid = None
        self.queued_dodge = False
        self.queued_active = False
        self._recalc_scale()

    # -- skalering -------------------------------------------------------
    def _recalc_scale(self):
        sw, sh = self.screen.get_size()
        self.scale = min(sw / C.VW, sh / C.VH)
        self.off_x = (sw - C.VW * self.scale) / 2
        self.off_y = (sh - C.VH * self.scale) / 2

    def to_virtual(self, px, py):
        return ((px - self.off_x) / self.scale, (py - self.off_y) / self.scale)

    # -- hendelser -------------------------------------------------------
    def handle_events(self):
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                self.running = False
            elif ev.type == pygame.VIDEORESIZE:
                self.screen = pygame.display.set_mode((ev.w, ev.h), pygame.RESIZABLE)
                self._recalc_scale()
            elif ev.type == pygame.FINGERDOWN:
                sw, sh = self.screen.get_size()
                self.pointer_down(("f", ev.finger_id),
                                  *self.to_virtual(ev.x * sw, ev.y * sh))
            elif ev.type == pygame.FINGERMOTION:
                sw, sh = self.screen.get_size()
                self.pointer_move(("f", ev.finger_id),
                                  *self.to_virtual(ev.x * sw, ev.y * sh))
            elif ev.type == pygame.FINGERUP:
                self.pointer_up(("f", ev.finger_id))
            elif ev.type == pygame.MOUSEBUTTONDOWN and not getattr(ev, "touch", False):
                self.pointer_down(("m", 0), *self.to_virtual(*ev.pos))
            elif ev.type == pygame.MOUSEMOTION and not getattr(ev, "touch", False):
                self.pointer_move(("m", 0), *self.to_virtual(*ev.pos))
            elif ev.type == pygame.MOUSEBUTTONUP and not getattr(ev, "touch", False):
                self.pointer_up(("m", 0))
            elif ev.type == pygame.KEYDOWN:
                self.on_key(ev.key)

    def on_key(self, key):
        w = self.world
        if key == pygame.K_ESCAPE:
            if w.state == "playing":
                w.state = "paused"
            elif w.state == "paused":
                w.state = "playing"
        elif key == pygame.K_SPACE:
            self.queued_dodge = True
        elif key in (pygame.K_e, pygame.K_LSHIFT):
            self.queued_active = True
        elif key == pygame.K_r and w.state == "dead":
            self.world = World()
        elif pygame.K_1 <= key <= pygame.K_4 and w.state == "levelup":
            w.choose_perk(key - pygame.K_1)
        elif key in (pygame.K_RETURN, pygame.K_KP_ENTER):
            if w.state == "stage_clear":
                w.next_stage()

    # -- pekere ----------------------------------------------------------
    def pointer_down(self, fid, vx, vy):
        w = self.world
        if w.state == "levelup":
            for i, r in enumerate(hud.perk_cards(len(w.pending_perks))):
                if r.collidepoint(vx, vy):
                    w.choose_perk(i)
                    return
            return
        if w.state == "stage_clear":
            w.next_stage()
            return
        if w.state == "paused":
            w.state = "playing"
            return
        if w.state == "dead":
            self.world = World()
            self.stick.update(active=False, fid=None, dx=0.0, dy=0.0)
            return

        if math.hypot(vx - hud.PAUSE_BTN[0], vy - hud.PAUSE_BTN[1]) < 14:
            w.state = "paused"
            return
        if math.hypot(vx - hud.DODGE_BTN[0], vy - hud.DODGE_BTN[1]) < hud.DODGE_R + 8:
            self.queued_dodge = True
            self.dodge_fid = fid
            return
        if (w.player.active_item and
                math.hypot(vx - hud.ACTIVE_BTN[0], vy - hud.ACTIVE_BTN[1]) < hud.ACTIVE_R + 8):
            self.queued_active = True
            self.active_fid = fid
            return
        if not self.stick["active"]:
            self.stick.update(active=True, fid=fid, base=(vx, vy), dx=0.0, dy=0.0)

    def pointer_move(self, fid, vx, vy):
        if self.stick["active"] and self.stick["fid"] == fid:
            bx, by = self.stick["base"]
            dx, dy = vx - bx, vy - by
            d = math.hypot(dx, dy)
            if d > hud.STICK_RADIUS:
                dx, dy = dx / d * hud.STICK_RADIUS, dy / d * hud.STICK_RADIUS
                d = hud.STICK_RADIUS
            self.stick["dx"] = dx / hud.STICK_RADIUS
            self.stick["dy"] = dy / hud.STICK_RADIUS

    def pointer_up(self, fid):
        if self.stick["fid"] == fid:
            self.stick.update(active=False, fid=None, dx=0.0, dy=0.0)
        if self.dodge_fid == fid:
            self.dodge_fid = None
        if self.active_fid == fid:
            self.active_fid = None

    # -- input til simuleringen -----------------------------------------
    def build_input(self) -> Input:
        keys = pygame.key.get_pressed()
        kx = (keys[pygame.K_d] or keys[pygame.K_RIGHT]) - (keys[pygame.K_a] or keys[pygame.K_LEFT])
        ky = (keys[pygame.K_s] or keys[pygame.K_DOWN]) - (keys[pygame.K_w] or keys[pygame.K_UP])
        mx = self.stick["dx"] + kx
        my = self.stick["dy"] + ky
        # liten dødsone så avataren ikke driver
        if math.hypot(mx, my) < 0.15:
            mx = my = 0.0
        inp = Input(mx, my, self.queued_dodge, self.queued_active)
        self.queued_dodge = False
        self.queued_active = False
        return inp

    # -- løkke -----------------------------------------------------------
    def run(self):
        while self.running:
            dt = self.clock.tick(60) / 1000.0
            self.handle_events()
            inp = self.build_input()
            self.world.update(dt, inp)
            self.cam.follow(self.world, dt)

            view.draw_world(self.canvas, self.world, self.cam)
            hud.draw_hud(self.canvas, self.world, self.fonts, self.stick)
            if self.world.state == "levelup":
                hud.draw_levelup(self.canvas, self.world, self.fonts)
            elif self.world.state == "stage_clear":
                hud.draw_stage_clear(self.canvas, self.world, self.fonts)
            elif self.world.state == "dead":
                hud.draw_dead(self.canvas, self.world, self.fonts)
            elif self.world.state == "paused":
                hud.draw_paused(self.canvas, self.world, self.fonts)

            self.screen.fill((0, 0, 0))
            scaled = pygame.transform.scale(
                self.canvas, (int(C.VW * self.scale), int(C.VH * self.scale)))
            self.screen.blit(scaled, (self.off_x, self.off_y))
            pygame.display.flip()
        pygame.quit()


if __name__ == "__main__":
    Game().run()
