"""Ren simulering. Ingen pygame-import her — hele filen kan kjøres, testes
og porteres uten grafikk.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

from . import config as C
from . import content as K
from .stats import StatBlock


# =========================================================================
# Hjelpere
# =========================================================================
def length(dx: float, dy: float) -> float:
    return math.hypot(dx, dy)


def normalize(dx: float, dy: float) -> tuple[float, float]:
    d = math.hypot(dx, dy)
    if d < 1e-6:
        return 0.0, 0.0
    return dx / d, dy / d


@dataclass
class Input:
    mx: float = 0.0          # joystick x, -1..1
    my: float = 0.0
    dodge: bool = False      # kun True i den framen knappen ble trykket
    active: bool = False


# =========================================================================
# Entiteter
# =========================================================================
_uid = 0


def next_uid() -> int:
    global _uid
    _uid += 1
    return _uid


class Entity:
    __slots__ = ("uid", "x", "y", "radius", "alive")

    def __init__(self, x, y, radius):
        self.uid = next_uid()
        self.x = float(x)
        self.y = float(y)
        self.radius = float(radius)
        self.alive = True


class Player(Entity):
    def __init__(self, x, y):
        super().__init__(x, y, C.PLAYER_RADIUS)
        self.stats = StatBlock()
        self.hp = self.stats.get("max_hp")
        self.sanity = self.stats.get("max_sanity")
        self.level = 1
        self.xp = 0
        self.xp_need = C.xp_to_next(1)
        self.weapons: list[K.WeaponInstance] = [K.WeaponInstance(K.STARTER_WEAPON)]
        self.items: list[str] = []
        self.active_item: str | None = None
        self.active_cd = 0.0
        self.facing = (0.0, 1.0)
        # Dodge
        self.dodge_timer = 0.0
        self.iframes = 0.0
        self.blink = False
        self.dash_vx = 0.0
        self.dash_vy = 0.0
        self.dash_time = 0.0
        # Spesialeffekter fra perks/items
        self.thorns = 0.0
        self.madness_scale = 1.0
        self.universal_corrupt = False
        self.burn_bonus = 0.0
        self.sanity_on_kill = 0.0
        self.taken_perks: dict[str, int] = {}

    # -- avledede verdier ------------------------------------------------
    @property
    def max_hp(self) -> float:
        return self.stats.get("max_hp")

    @property
    def max_sanity(self) -> float:
        return max(10.0, self.stats.get("max_sanity"))

    @property
    def sanity_frac(self) -> float:
        return max(0.0, min(1.0, self.sanity / self.max_sanity))

    @property
    def madness_bonus(self) -> float:
        """Lav SAN gir skadebonus. Dette er den mekaniske gulroten."""
        f = self.sanity_frac
        return (1.0 - f) * C.MADNESS_DAMAGE_BONUS * self.madness_scale

    def heal(self, amount: float) -> None:
        self.hp = min(self.max_hp, self.hp + amount)


class Enemy(Entity):
    def __init__(self, kind: str, x, y, hp_mul=1.0, dmg_mul=1.0):
        d = K.ENEMIES[kind]
        super().__init__(x, y, d["radius"])
        self.kind = kind
        self.data = d
        self.max_hp = d["hp"] * hp_mul
        self.hp = self.max_hp
        self.damage = d["damage"] * dmg_mul
        self.speed = d["speed"]
        self.contact_timer = 0.0
        self.shot_timer = random.uniform(0.3, 1.5)
        self.statuses: dict[str, float] = {}   # navn -> gjenstående tid
        self.freeze = 0.0
        self.flash = 0.0
        self.knock_x = 0.0
        self.knock_y = 0.0

    @property
    def is_boss(self) -> bool:
        return bool(self.data.get("boss"))

    @property
    def is_elite(self) -> bool:
        return bool(self.data.get("elite"))

    @property
    def is_phantom(self) -> bool:
        return "phantom" in self.data["tags"]


class Projectile(Entity):
    def __init__(self, x, y, vx, vy, damage, tag, pierce, life, sprite,
                 applies=None, orbit=None, homing=False, area=1.0):
        super().__init__(x, y, 2.5 * area)
        self.vx, self.vy = vx, vy
        self.damage = damage
        self.tag = tag
        self.pierce = pierce
        self.life = life
        self.sprite = sprite
        self.applies = applies
        self.orbit = orbit          # (radius, angle, angular_speed) eller None
        self.homing = homing
        self.target: Enemy | None = None
        self.hit_times: dict[int, float] = {}
        self.age = 0.0
        self.area = area


class Pickup(Entity):
    def __init__(self, x, y, kind, value=0, payload=None):
        super().__init__(x, y, 3.0)
        self.kind = kind            # 'xp' | 'heal' | 'item'
        self.value = value
        self.payload = payload
        self.vx = random.uniform(-30, 30)
        self.vy = random.uniform(-30, 30)
        self.age = 0.0


@dataclass
class Effect:
    x: float
    y: float
    kind: str
    radius: float = 0.0
    life: float = 0.3
    age: float = 0.0
    x2: float = 0.0
    y2: float = 0.0


@dataclass
class Floater:
    x: float
    y: float
    text: str
    color: tuple
    life: float = 0.7
    age: float = 0.0


# =========================================================================
# Romlig rutenett — gjør kollisjonssjekk O(n) i stedet for O(n²)
# =========================================================================
class Grid:
    CELL = 32

    def __init__(self):
        self.cells: dict[tuple[int, int], list] = {}

    def rebuild(self, entities) -> None:
        self.cells.clear()
        c = self.CELL
        for e in entities:
            key = (int(e.x // c), int(e.y // c))
            self.cells.setdefault(key, []).append(e)

    def query(self, x, y, r):
        c = self.CELL
        x0, x1 = int((x - r) // c), int((x + r) // c)
        y0, y1 = int((y - r) // c), int((y + r) // c)
        out = []
        for gx in range(x0, x1 + 1):
            for gy in range(y0, y1 + 1):
                bucket = self.cells.get((gx, gy))
                if bucket:
                    out.extend(bucket)
        return out


# =========================================================================
# Verden
# =========================================================================
class World:
    def __init__(self, seed: int | None = None):
        self.rng = random.Random(seed)
        self.player = Player(C.ARENA_W / 2, C.ARENA_H / 2)
        self.enemies: list[Enemy] = []
        self.projectiles: list[Projectile] = []
        self.enemy_shots: list[Projectile] = []
        self.pickups: list[Pickup] = []
        self.effects: list[Effect] = []
        self.floaters: list[Floater] = []
        self.grid = Grid()

        self.state = "playing"       # playing | levelup | paused | dead | stage_clear
        self.pending_perks: list[K.Perk] = []
        self.pending_drop: dict | None = None

        self.stage_index = 0
        self.loop = 0
        self.time = 0.0
        self.stage_time = 0.0
        self.kills = 0
        self.spawn_queue: list[dict] = []
        self.boss_spawned = False
        self.boss_dead = False
        self.phantom_timer = 0.0
        self.shake = 0.0
        self._load_stage()

    # -- baner -----------------------------------------------------------
    @property
    def stage(self) -> dict:
        return K.STAGES[self.stage_index % len(K.STAGES)]

    @property
    def hp_mul(self) -> float:
        return (1.0 + K.STAGE_SCALE_HP * self.stage_index) * (1.0 + 0.5 * self.loop)

    @property
    def dmg_mul(self) -> float:
        return (1.0 + K.STAGE_SCALE_DMG * self.stage_index) * (1.0 + 0.3 * self.loop)

    def _load_stage(self) -> None:
        self.stage_time = 0.0
        self.boss_spawned = False
        self.boss_dead = False
        self.spawn_queue = []
        for kind, count, interval, delay in self.stage["waves"]:
            self.spawn_queue.append(dict(kind=kind, left=count, interval=interval,
                                         timer=delay))

    def next_stage(self) -> None:
        self.stage_index += 1
        if self.stage_index % len(K.STAGES) == 0:
            self.loop += 1
        self.enemies.clear()
        self.enemy_shots.clear()
        self._load_stage()
        self.state = "playing"

    # -- hovedløkke ------------------------------------------------------
    def update(self, dt: float, inp: Input) -> None:
        if self.state != "playing":
            return
        dt = min(dt, 1 / 30)         # aldri simuler mer enn ett tredvedelssekund
        self.time += dt
        self.stage_time += dt
        p = self.player

        self.grid.rebuild(self.enemies)
        self._update_player(dt, inp)
        self._update_spawning(dt)
        self._update_enemies(dt)
        self._update_weapons(dt)
        self._update_projectiles(dt)
        self._update_enemy_shots(dt)
        self._update_pickups(dt)
        self._update_sanity(dt)
        self._update_transients(dt)

        if p.hp <= 0:
            self.state = "dead"
        elif self.boss_dead and not self.enemies and not any(
                i.kind == "item" for i in self.pickups):
            self.state = "stage_clear"

    # -- spiller ---------------------------------------------------------
    def _update_player(self, dt: float, inp: Input) -> None:
        p = self.player
        p.dodge_timer = max(0.0, p.dodge_timer - dt)
        p.iframes = max(0.0, p.iframes - dt)
        p.active_cd = max(0.0, p.active_cd - dt)
        if p.stats.get("hp_regen") > 0:
            p.heal(p.stats.get("hp_regen") * dt)

        mx, my = inp.mx, inp.my
        mag = length(mx, my)
        if mag > 1.0:
            mx, my = mx / mag, my / mag
            mag = 1.0
        if mag > 0.05:
            p.facing = normalize(mx, my)

        # Dodge / blink
        if inp.dodge and p.dodge_timer <= 0.0:
            dx, dy = p.facing
            dist = p.stats.get("dodge_distance")
            if p.blink:
                p.x = max(8, min(C.ARENA_W - 8, p.x + dx * dist))
                p.y = max(8, min(C.ARENA_H - 8, p.y + dy * dist))
                self.effects.append(Effect(p.x, p.y, "blink", radius=12, life=0.25))
            else:
                p.dash_time = 0.14
                p.dash_vx = dx * dist / 0.14
                p.dash_vy = dy * dist / 0.14
            p.iframes = p.stats.get("dodge_iframes")
            p.dodge_timer = max(0.3, p.stats.get("dodge_cooldown"))

        if inp.active and p.active_item and p.active_cd <= 0.0:
            self._fire_active()

        if p.dash_time > 0.0:
            p.dash_time -= dt
            p.x += p.dash_vx * dt
            p.y += p.dash_vy * dt
        else:
            spd = p.stats.get("move_speed")
            p.x += mx * spd * dt
            p.y += my * spd * dt

        p.x = max(6, min(C.ARENA_W - 6, p.x))
        p.y = max(6, min(C.ARENA_H - 6, p.y))

    def _fire_active(self) -> None:
        p = self.player
        d = K.ITEMS[p.active_item]
        eff = d["effect"]
        p.active_cd = d["cooldown"]
        if eff == "blast":
            r = 70 * p.stats.get("area_mult")
            self.effects.append(Effect(p.x, p.y, "blast", radius=r, life=0.35))
            for e in self.grid.query(p.x, p.y, r):
                if length(e.x - p.x, e.y - p.y) <= r:
                    self.damage_enemy(e, 60, "physical")
            self.shake = max(self.shake, 6.0)
        elif eff == "freeze":
            for e in self.enemies:
                e.freeze = max(e.freeze, 3.0)
            self.effects.append(Effect(p.x, p.y, "freeze", radius=200, life=0.4))
        elif eff == "heal":
            p.heal(40)
            p.sanity = max(0.0, p.sanity - 10)
            self.floaters.append(Floater(p.x, p.y - 8, "+40", (120, 230, 140)))

    # -- spawning --------------------------------------------------------
    def _update_spawning(self, dt: float) -> None:
        for w in self.spawn_queue:
            if w["left"] <= 0:
                continue
            w["timer"] -= dt
            if w["timer"] <= 0.0:
                w["timer"] = w["interval"]
                w["left"] -= 1
                self.spawn(w["kind"])

        done = all(w["left"] <= 0 for w in self.spawn_queue)
        if done and not self.boss_spawned and not self.enemies:
            self.boss_spawned = True
            self.spawn(self.stage["boss"], distance=150)
            self.shake = 10.0

    def spawn(self, kind: str, distance: float | None = None) -> Enemy:
        p = self.player
        ang = self.rng.uniform(0, math.tau)
        dist = distance if distance is not None else self.rng.uniform(160, 230)
        x = max(10, min(C.ARENA_W - 10, p.x + math.cos(ang) * dist))
        y = max(10, min(C.ARENA_H - 10, p.y + math.sin(ang) * dist))
        e = Enemy(kind, x, y, self.hp_mul, self.dmg_mul)
        self.enemies.append(e)
        return e

    # -- fiender ---------------------------------------------------------
    def _update_enemies(self, dt: float) -> None:
        p = self.player
        alive = []
        for e in self.enemies:
            if not e.alive:
                continue
            e.flash = max(0.0, e.flash - dt)
            e.freeze = max(0.0, e.freeze - dt)

            # statuser
            self._tick_statuses(e, dt)
            if not e.alive:
                continue

            dx, dy = p.x - e.x, p.y - e.y
            dist = length(dx, dy)
            nx, ny = normalize(dx, dy)

            speed = e.speed
            if "chill" in e.statuses:
                speed *= 1.0 - C.CHILL_SLOW
            if e.freeze > 0:
                speed = 0.0

            ranged = e.data.get("ranged")
            if ranged and dist < e.data["shot_range"] * 0.8:
                speed *= 0.25            # skyttere holder avstand
            e.x += nx * speed * dt + e.knock_x * dt
            e.y += ny * speed * dt + e.knock_y * dt
            e.knock_x *= 0.85
            e.knock_y *= 0.85

            if ranged:
                e.shot_timer -= dt
                if e.shot_timer <= 0 and dist < e.data["shot_range"]:
                    e.shot_timer = e.data["shot_cd"]
                    sp = e.data["shot_speed"]
                    self.enemy_shots.append(Projectile(
                        e.x, e.y, nx * sp, ny * sp, e.damage * 0.7,
                        "physical", 0, 3.0, "eshot"))

            # kontaktskade
            e.contact_timer = max(0.0, e.contact_timer - dt)
            if dist < e.radius + p.radius and e.contact_timer <= 0.0:
                e.contact_timer = C.CONTACT_TICK
                self.hurt_player(e.damage)
                if p.thorns > 0:
                    self.damage_enemy(e, p.thorns, "physical")
            alive.append(e)
        self.enemies = alive

    def _tick_statuses(self, e: Enemy, dt: float) -> None:
        p = self.player
        for name in list(e.statuses):
            e.statuses[name] -= dt
            if e.statuses[name] <= 0:
                del e.statuses[name]
                continue
            if name == "burn":
                self.damage_enemy(e, C.BURN_DPS * dt * p.stats.tag("fire"),
                                  "fire", silent=True)
            elif name == "bleed":
                self.damage_enemy(e, C.BLEED_DPS * dt * p.stats.tag("bleed"),
                                  "bleed", silent=True)

    # -- våpen -----------------------------------------------------------
    def _update_weapons(self, dt: float) -> None:
        p = self.player
        rate = max(0.15, p.stats.get("fire_rate_mult"))
        for w in p.weapons:
            w.timer -= dt * rate
            if w.timer <= 0.0:
                w.timer = w.stat("cooldown")
                self._fire(w)

    def nearest_enemy(self, x, y, radius) -> Enemy | None:
        best, bd = None, radius * radius
        for e in self.grid.query(x, y, radius):
            d = (e.x - x) ** 2 + (e.y - y) ** 2
            if d < bd:
                best, bd = e, d
        return best

    def _fire(self, w: K.WeaponInstance) -> None:
        p = self.player
        d = w.data
        beh = d["behavior"]
        rng = w.stat("range") * p.stats.get("range_mult")
        area = p.stats.get("area_mult")
        dmg = w.stat("damage")
        tag = d["tag"]
        applies = d.get("applies")
        if p.universal_corrupt and not applies:
            applies = "corrupt"

        if beh == "aura":
            r = rng * area
            self.effects.append(Effect(p.x, p.y, "aura", radius=r, life=0.18))
            for e in self.grid.query(p.x, p.y, r):
                if length(e.x - p.x, e.y - p.y) <= r + e.radius:
                    self.damage_enemy(e, dmg, tag, applies=applies)
            return

        if beh == "orbit":
            count = int(w.stat("count"))
            radius = rng * area
            speed = w.stat("speed")
            life = w.stat("cooldown") * 1.08
            for i in range(count):
                ang = w.orbit_phase + math.tau * i / max(1, count)
                pr = Projectile(p.x, p.y, 0, 0, dmg, tag, 99, life,
                                d["sprite"], applies=applies,
                                orbit=(radius, ang, speed), area=area)
                self.projectiles.append(pr)
            w.orbit_phase += 0.7
            return

        target = self.nearest_enemy(p.x, p.y, rng)
        if target is None and beh != "spread":
            return
        if target is not None:
            aim = normalize(target.x - p.x, target.y - p.y)
        else:
            aim = p.facing

        if beh == "beam":
            count = int(w.stat("count"))
            for i in range(count):
                off = 0.0 if count == 1 else (i - (count - 1) / 2) * 0.25
                ax = aim[0] * math.cos(off) - aim[1] * math.sin(off)
                ay = aim[0] * math.sin(off) + aim[1] * math.cos(off)
                ex, ey = p.x + ax * rng, p.y + ay * rng
                self.effects.append(Effect(p.x, p.y, "beam", life=0.15,
                                           x2=ex, y2=ey))
                for e in self.grid.query((p.x + ex) / 2, (p.y + ey) / 2, rng):
                    if self._point_near_segment(e.x, e.y, p.x, p.y, ex, ey) < e.radius + 4:
                        self.damage_enemy(e, dmg, tag, applies=applies)
            return

        count = int(w.stat("count"))
        speed = w.stat("speed") * p.stats.get("proj_speed_mult")
        spread = d["spread"]
        pierce = int(w.stat("pierce"))
        life = rng / max(20.0, speed) * 1.15
        for i in range(count):
            if count > 1:
                off = (i - (count - 1) / 2) * (spread if spread else 0.18)
            else:
                off = 0.0
            off += self.rng.uniform(-0.03, 0.03)
            ax = aim[0] * math.cos(off) - aim[1] * math.sin(off)
            ay = aim[0] * math.sin(off) + aim[1] * math.cos(off)
            pr = Projectile(p.x, p.y, ax * speed, ay * speed, dmg, tag,
                            pierce, life, d["sprite"], applies=applies,
                            homing=(beh == "homing"), area=area)
            if beh == "homing":
                pr.target = target
            self.projectiles.append(pr)

    @staticmethod
    def _point_near_segment(px, py, ax, ay, bx, by) -> float:
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        if L < 1e-6:
            return length(px - ax, py - ay)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
        return length(px - (ax + t * dx), py - (ay + t * dy))

    # -- prosjektiler ----------------------------------------------------
    def _update_projectiles(self, dt: float) -> None:
        p = self.player
        keep = []
        for pr in self.projectiles:
            pr.age += dt
            pr.life -= dt
            if pr.life <= 0:
                continue
            if pr.orbit:
                radius, ang, angspeed = pr.orbit
                ang += angspeed * dt
                pr.orbit = (radius, ang, angspeed)
                pr.x = p.x + math.cos(ang) * radius
                pr.y = p.y + math.sin(ang) * radius
            else:
                if pr.homing and pr.target is not None and pr.target.alive:
                    tx, ty = normalize(pr.target.x - pr.x, pr.target.y - pr.y)
                    sp = length(pr.vx, pr.vy)
                    cx, cy = normalize(pr.vx, pr.vy)
                    nx, ny = normalize(cx + tx * 4.5 * dt * 2, cy + ty * 4.5 * dt * 2)
                    pr.vx, pr.vy = nx * sp, ny * sp
                elif pr.homing:
                    pr.target = self.nearest_enemy(pr.x, pr.y, 90)
                pr.x += pr.vx * dt
                pr.y += pr.vy * dt

            dead = False
            for e in self.grid.query(pr.x, pr.y, pr.radius + 8):
                if length(e.x - pr.x, e.y - pr.y) > e.radius + pr.radius:
                    continue
                last = pr.hit_times.get(e.uid)
                if last is not None and pr.age - last < 0.45:
                    continue
                pr.hit_times[e.uid] = pr.age
                self.damage_enemy(e, pr.damage, pr.tag, applies=pr.applies,
                                  knock=(pr.vx, pr.vy))
                if pr.pierce <= 0:
                    dead = True
                    break
                pr.pierce -= 1
            if not dead:
                keep.append(pr)
        self.projectiles = keep

    def _update_enemy_shots(self, dt: float) -> None:
        p = self.player
        keep = []
        for pr in self.enemy_shots:
            pr.life -= dt
            pr.x += pr.vx * dt
            pr.y += pr.vy * dt
            if pr.life <= 0:
                continue
            if length(pr.x - p.x, pr.y - p.y) < p.radius + pr.radius:
                self.hurt_player(pr.damage)
                continue
            keep.append(pr)
        self.enemy_shots = keep

    # -- skade -----------------------------------------------------------
    def damage_enemy(self, e: Enemy, amount: float, tag: str,
                     applies: str | None = None, knock=None,
                     silent: bool = False) -> None:
        if not e.alive:
            return
        p = self.player
        dmg = amount * p.stats.get("damage_mult") * p.stats.tag(tag)
        dmg *= 1.0 + p.madness_bonus

        # --- SYNERGI: ild på nedkjølt fiende ---------------------------
        shock = False
        if tag == "fire" and "chill" in e.statuses:
            dmg *= C.THERMAL_SHOCK_MULT
            del e.statuses["chill"]
            shock = True
            self.effects.append(Effect(e.x, e.y, "shock", radius=14, life=0.25))

        # --- Fordervelse gjør fienden sårbar ---------------------------
        if "corrupt" in e.statuses:
            dmg *= 1.0 + C.CORRUPT_VULN

        crit = False
        if not silent and self.rng.random() < p.stats.get("crit_chance"):
            crit = True
            dmg *= p.stats.get("crit_mult")
            # --- SYNERGI: krit forlenger blødning ----------------------
            if "bleed" in e.statuses:
                e.statuses["bleed"] += C.BLEED_DURATION * 0.5

        e.hp -= dmg
        e.flash = 0.08
        if knock and not e.is_boss:
            kx, ky = normalize(*knock)
            e.knock_x += kx * 40
            e.knock_y += ky * 40

        if applies:
            self._apply_status(e, applies)

        if not silent and dmg >= 1:
            col = (255, 220, 120) if crit else (235, 235, 235)
            self.floaters.append(Floater(e.x, e.y - e.radius - 2,
                                         str(int(dmg)), col, life=0.55))
        if e.hp <= 0:
            self._kill(e)

    def _apply_status(self, e: Enemy, name: str) -> None:
        p = self.player
        dur = {"burn": C.BURN_DURATION + p.burn_bonus,
               "chill": C.CHILL_DURATION,
               "bleed": C.BLEED_DURATION,
               "corrupt": C.CORRUPT_DURATION}.get(name, 2.0)
        e.statuses[name] = max(e.statuses.get(name, 0.0), dur)

    def _kill(self, e: Enemy) -> None:
        if not e.alive:
            return
        e.alive = False
        self.kills += 1
        p = self.player

        # --- SYNERGI: fordervet fiende detonerer ved død ---------------
        if "corrupt" in e.statuses:
            r = C.CORRUPT_BLAST_RADIUS * p.stats.get("area_mult")
            blast = C.CORRUPT_BLAST_DAMAGE
            if "burn" in e.statuses:
                blast *= 2.0            # ild + fordervelse = større smell
                r *= 1.35
            self.effects.append(Effect(e.x, e.y, "corrupt_blast", radius=r, life=0.3))
            for o in self.grid.query(e.x, e.y, r):
                if o is not e and length(o.x - e.x, o.y - e.y) <= r:
                    self.damage_enemy(o, blast, "eldritch")

        if p.sanity_on_kill and length(e.x - p.x, e.y - p.y) < 40:
            p.sanity = min(p.max_sanity, p.sanity + p.sanity_on_kill)

        if e.is_phantom:
            self.effects.append(Effect(e.x, e.y, "poof", radius=8, life=0.25))
            return

        xp = e.data["xp"]
        if xp:
            self.pickups.append(Pickup(e.x, e.y, "xp", value=xp))

        luck = p.stats.get("luck")
        if e.is_boss:
            for _ in range(C.BOSS_DROP_COUNT):
                self.pickups.append(Pickup(
                    e.x + self.rng.uniform(-14, 14),
                    e.y + self.rng.uniform(-14, 14), "item",
                    payload=self._roll_drop()))
            self.shake = 8.0
            self.boss_dead = True
        elif e.is_elite:
            if self.rng.random() < C.ELITE_DROP_CHANCE + luck * 0.05:
                self.pickups.append(Pickup(e.x, e.y, "item", payload=self._roll_drop()))
        if self.rng.random() < C.HEAL_DROP_CHANCE * (1 + luck * 0.1) * 0.3:
            self.pickups.append(Pickup(e.x, e.y, "heal", value=15))

    def hurt_player(self, amount: float) -> None:
        p = self.player
        if p.iframes > 0 or p.dash_time > 0:
            return
        dmg = max(1.0, amount - p.stats.get("armor"))
        p.hp -= dmg
        p.iframes = 0.25
        self.shake = max(self.shake, 3.0)
        self.floaters.append(Floater(p.x, p.y - 8, str(int(dmg)), (240, 90, 90)))

    # -- drops -----------------------------------------------------------
    def _roll_drop(self) -> dict:
        p = self.player
        roll = self.rng.random()
        owned_w = {w.wid for w in p.weapons}
        new_w = [k for k in K.WEAPONS if k not in owned_w]
        upgradable = [w for w in p.weapons if not w.maxed]

        if roll < 0.30 and new_w and len(p.weapons) < 5:
            wid = self.rng.choice(new_w)
            return dict(kind="weapon", key=wid, name=K.WEAPONS[wid]["name"],
                        desc=K.WEAPONS[wid]["desc"], sprite="item_weapon")
        if roll < 0.55 and upgradable:
            w = self.rng.choice(upgradable)
            nxt = w.data["levels"][w.level - 1]
            return dict(kind="wlevel", key=w.wid,
                        name=f"{w.name} nivå {w.level + 1}",
                        desc=nxt, sprite="item_weapon")
        pool = [k for k, v in K.ITEMS.items() if k not in p.items or v["kind"] == "armor"]
        if not pool:
            pool = list(K.ITEMS)
        key = self.rng.choice(pool)
        d = K.ITEMS[key]
        return dict(kind=d["kind"], key=key, name=d["name"], desc=d["desc"],
                    sprite=d["sprite"])

    def take_drop(self, drop: dict) -> None:
        p = self.player
        k = drop["kind"]
        key = drop["key"]
        if k == "weapon":
            existing = next((w for w in p.weapons if w.wid == key), None)
            if existing is not None:
                if not existing.maxed:
                    existing.level += 1
            else:
                p.weapons.append(K.WeaponInstance(key))
        elif k == "wlevel":
            for w in p.weapons:
                if w.wid == key and not w.maxed:
                    w.level += 1
                    break
        elif k == "active":
            p.active_item = key
            p.active_cd = 0.0
        else:
            p.items.append(key)
            K.ITEMS[key]["apply"](self)
        self.floaters.append(Floater(p.x, p.y - 12, drop["name"], (200, 180, 255), life=1.4))

    # -- pickups ---------------------------------------------------------
    def _update_pickups(self, dt: float) -> None:
        p = self.player
        pr = p.stats.get("pickup_radius")
        keep = []
        for it in self.pickups:
            it.age += dt
            d = length(it.x - p.x, it.y - p.y)
            if d < pr:
                nx, ny = normalize(p.x - it.x, p.y - it.y)
                sp = C.XP_MAGNET_SPEED * (1.0 - d / pr * 0.4)
                it.x += nx * sp * dt
                it.y += ny * sp * dt
            else:
                it.x += it.vx * dt
                it.y += it.vy * dt
                it.vx *= 0.9
                it.vy *= 0.9
            if d < p.radius + 4:
                self._collect(it)
                continue
            keep.append(it)
        self.pickups = keep

    def _collect(self, it: Pickup) -> None:
        p = self.player
        if it.kind == "xp":
            p.xp += it.value
            while p.xp >= p.xp_need:
                p.xp -= p.xp_need
                p.level += 1
                p.xp_need = C.xp_to_next(p.level)
                self._offer_perks()
        elif it.kind == "heal":
            p.heal(it.value)
            self.floaters.append(Floater(p.x, p.y - 8, f"+{it.value}", (120, 230, 140)))
        elif it.kind == "item":
            self.take_drop(it.payload)

    # -- level up --------------------------------------------------------
    def _offer_perks(self) -> None:
        p = self.player
        pool = []
        for perk in K.PERKS:
            if not perk.repeatable and perk.pid in p.taken_perks:
                continue
            # Tag-perks er bare interessante hvis du faktisk har den skadetypen
            if perk.tags:
                owned = {K.WEAPONS[w.wid]["tag"] for w in p.weapons}
                if not set(perk.tags) & owned:
                    continue
            pool.append(perk)
        picks = self.rng.sample(pool, min(C.PERK_CHOICES, len(pool)))
        if self.rng.random() < C.FORBIDDEN_CHANCE:
            cands = [f for f in K.FORBIDDEN
                     if (f.repeatable or f.pid not in p.taken_perks)
                     and p.max_sanity - f.sanity_cost > 10]
            if cands:
                picks.append(self.rng.choice(cands))
        self.pending_perks = picks
        self.state = "levelup"

    def choose_perk(self, index: int) -> None:
        if self.state != "levelup" or not (0 <= index < len(self.pending_perks)):
            return
        p = self.player
        perk = self.pending_perks[index]
        perk.apply(self)
        p.taken_perks[perk.pid] = p.taken_perks.get(perk.pid, 0) + 1
        if perk.sanity_cost:
            p.stats.add("max_sanity", -perk.sanity_cost)
            p.sanity = min(p.sanity, p.max_sanity)
        p.hp = min(p.hp, p.max_hp)
        self.pending_perks = []
        self.state = "playing"

    # -- sanity ----------------------------------------------------------
    def _update_sanity(self, dt: float) -> None:
        p = self.player
        drain = 0.0
        big = C.SANITY_DRAIN_RADIUS * 2.6
        for e in self.grid.query(p.x, p.y, big):
            if "eldritch" not in e.data["tags"]:
                continue
            radius = big if e.is_boss else C.SANITY_DRAIN_RADIUS
            d = length(e.x - p.x, e.y - p.y)
            if d < radius:
                falloff = 1.0 - d / radius
                rate = C.SANITY_DRAIN_RATE * (2.2 if e.is_boss else 1.0)
                drain += rate * falloff
        p.sanity += (p.stats.get("sanity_regen") - drain) * dt
        p.sanity = max(0.0, min(p.max_sanity, p.sanity))

        # Fantomer: hallusinasjoner som gjør ekte skade, men gir null XP.
        if p.sanity_frac < C.SANITY_LOW:
            self.phantom_timer -= dt
            if self.phantom_timer <= 0:
                severity = (C.SANITY_LOW - p.sanity_frac) / C.SANITY_LOW
                self.phantom_timer = max(1.2, 6.0 - severity * 4.5)
                self.spawn("phantom", distance=self.rng.uniform(90, 150))
        else:
            self.phantom_timer = 3.0

    # -- kortlivede ting -------------------------------------------------
    def _update_transients(self, dt: float) -> None:
        self.shake = max(0.0, self.shake - dt * 20)
        for e in self.effects:
            e.age += dt
        self.effects = [e for e in self.effects if e.age < e.life]
        for f in self.floaters:
            f.age += dt
            f.y -= 14 * dt
        self.floaters = [f for f in self.floaters if f.age < f.life]
