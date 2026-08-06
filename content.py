"""Alt innhold som data. Legg til nye våpen, perks, items og fiender her —
world.py skal aldri trenge endring for å utvide spillet.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# =========================================================================
# FIENDER
# =========================================================================
# tags: 'eldritch' tapper sanity ved nærhet, 'phantom' er hallusinasjon
ENEMIES: dict[str, dict] = {
    "grunt": dict(name="Tjener", hp=14, speed=32, damage=6, radius=4,
                  xp=1, sprite="grunt", tags=()),
    "runner": dict(name="Hund", hp=9, speed=58, damage=5, radius=3,
                   xp=1, sprite="runner", tags=()),
    "brute": dict(name="Kadaver", hp=60, speed=20, damage=14, radius=7,
                  xp=4, sprite="brute", tags=(), elite=True),
    "spitter": dict(name="Spytter", hp=26, speed=26, damage=9, radius=5,
                    xp=3, sprite="spitter", tags=(), ranged=True,
                    shot_range=120, shot_cd=2.2, shot_speed=70),
    "wretch": dict(name="Usling", hp=40, speed=30, damage=10, radius=5,
                   xp=3, sprite="wretch", tags=("eldritch",), elite=True),
    "phantom": dict(name="Fantom", hp=18, speed=44, damage=8, radius=4,
                    xp=0, sprite="phantom", tags=("eldritch", "phantom")),
    # Bosser
    "boss_maw": dict(name="GAPET", hp=900, speed=18, damage=22, radius=13,
                     xp=60, sprite="boss_maw", tags=("eldritch",), boss=True),
    "boss_crawler": dict(name="KRYPET", hp=1500, speed=25, damage=26, radius=14,
                         xp=90, sprite="boss_crawler", tags=(), boss=True,
                         ranged=True, shot_range=200, shot_cd=1.4, shot_speed=95),
    "boss_eye": dict(name="DET SOM SER", hp=2400, speed=15, damage=30, radius=15,
                     xp=140, sprite="boss_eye", tags=("eldritch",), boss=True,
                     ranged=True, shot_range=240, shot_cd=1.0, shot_speed=110),
}

# =========================================================================
# VÅPEN
# =========================================================================
# behavior: shot | spread | orbit | aura | beam | homing
WEAPONS: dict[str, dict] = {
    "pistol": dict(
        name="Tjenestepistol", behavior="shot", tag="physical",
        damage=8, cooldown=0.55, range=130, speed=210, count=1,
        pierce=0, spread=0.0, sprite="bullet",
        desc="Pålitelig. Kjedelig. Treffer alltid nærmeste.",
        levels=["+1 prosjektil", "+40 % skade", "+1 gjennomtrenging",
                "-25 % ladetid", "+2 prosjektiler"]),
    "shotgun": dict(
        name="Hagle", behavior="spread", tag="physical",
        damage=6, cooldown=1.1, range=90, speed=180, count=5,
        pierce=0, spread=0.55, sprite="bullet",
        desc="Fem hagl i en vifte. Elsker trange rom.",
        levels=["+2 hagl", "+35 % skade", "-20 % ladetid",
                "+50 % rekkevidde", "+3 hagl"]),
    "censer": dict(
        name="Røkelseskar", behavior="orbit", tag="fire",
        damage=9, cooldown=2.0, range=34, speed=2.6, count=2,
        pierce=99, spread=0.0, sprite="ember", applies="burn",
        desc="Brennende kar som kretser om deg. Antenner alt de rører.",
        levels=["+1 kar", "+40 % skade", "+30 % bane",
                "+1 kar", "+50 % rotasjonsfart"]),
    "frostlamp": dict(
        name="Frostlykt", behavior="aura", tag="frost",
        damage=4, cooldown=0.8, range=48, speed=0, count=1,
        pierce=99, spread=0.0, sprite=None, applies="chill",
        desc="Kulden siver ut fra deg og gjør alt tregt.",
        levels=["+40 % radius", "+50 % skade", "-25 % pulsintervall",
                "+40 % radius", "Frost sprer seg ved død"]),
    "ripper": dict(
        name="Rivejern", behavior="shot", tag="bleed",
        damage=11, cooldown=0.9, range=70, speed=160, count=1,
        pierce=2, spread=0.15, sprite="shard", applies="bleed",
        desc="Roterende tenner. Ofrene forblør mens de går.",
        levels=["+1 prosjektil", "+45 % skade", "+2 gjennomtrenging",
                "-25 % ladetid", "Blødning varer dobbelt"]),
    "voidlance": dict(
        name="Tomromslanse", behavior="beam", tag="eldritch",
        damage=26, cooldown=1.8, range=200, speed=0, count=1,
        pierce=99, spread=0.0, sprite=None, applies="corrupt",
        desc="En stråle av ingenting. Merker alt den treffer.",
        levels=["+45 % skade", "-25 % ladetid", "+60 % rekkevidde",
                "+2 stråler", "Fordervelse dobler eksplosjonen"]),
    "swarm": dict(
        name="Yngelsverm", behavior="homing", tag="eldritch",
        damage=7, cooldown=1.3, range=150, speed=120, count=3,
        pierce=0, spread=1.2, sprite="spawn",
        desc="Små ting du helst ikke ser på. De finner veien selv.",
        levels=["+2 yngel", "+40 % skade", "+40 % fart",
                "+3 yngel", "Yngel deler seg ved død"]),
}

STARTER_WEAPON = "pistol"


@dataclass
class WeaponInstance:
    wid: str
    level: int = 1
    timer: float = 0.0
    orbit_phase: float = 0.0

    @property
    def data(self) -> dict:
        return WEAPONS[self.wid]

    @property
    def name(self) -> str:
        return self.data["name"]

    @property
    def maxed(self) -> bool:
        return self.level > len(self.data["levels"])

    # Nivåbonusene ligger som ren data over; her tolkes de til tall.
    def stat(self, key: str) -> float:
        d = self.data
        v = float(d.get(key, 0))
        lv = self.level - 1
        wid = self.wid
        if key == "damage":
            bump = {"pistol": [0, .4, 0, 0, 0], "shotgun": [0, .35, 0, 0, 0],
                    "censer": [0, .4, 0, 0, 0], "frostlamp": [0, .5, 0, 0, 0],
                    "ripper": [0, .45, 0, 0, 0], "voidlance": [.45, 0, 0, 0, 0],
                    "swarm": [0, .4, 0, 0, 0]}.get(wid, [])
            v *= 1.0 + sum(bump[:lv])
        elif key == "count":
            bump = {"pistol": [1, 0, 0, 0, 2], "shotgun": [2, 0, 0, 0, 3],
                    "censer": [1, 0, 0, 1, 0], "frostlamp": [0] * 5,
                    "ripper": [1, 0, 0, 0, 0], "voidlance": [0, 0, 0, 2, 0],
                    "swarm": [2, 0, 0, 3, 0]}.get(wid, [])
            v += sum(bump[:lv])
        elif key == "cooldown":
            bump = {"pistol": [0, 0, 0, .25, 0], "shotgun": [0, 0, .2, 0, 0],
                    "censer": [0] * 5, "frostlamp": [0, 0, .25, 0, 0],
                    "ripper": [0, 0, 0, .25, 0], "voidlance": [0, .25, 0, 0, 0],
                    "swarm": [0] * 5}.get(wid, [])
            v *= max(0.15, 1.0 - sum(bump[:lv]))
        elif key == "range":
            bump = {"pistol": [0] * 5, "shotgun": [0, 0, 0, .5, 0],
                    "censer": [0, 0, .3, 0, 0], "frostlamp": [.4, 0, 0, .4, 0],
                    "ripper": [0] * 5, "voidlance": [0, 0, .6, 0, 0],
                    "swarm": [0] * 5}.get(wid, [])
            v *= 1.0 + sum(bump[:lv])
        elif key == "pierce":
            bump = {"pistol": [0, 0, 1, 0, 0], "ripper": [0, 0, 2, 0, 0]}.get(wid, [])
            v += sum(bump[:lv])
        elif key == "speed":
            bump = {"censer": [0, 0, 0, 0, .5], "swarm": [0, 0, .4, 0, 0]}.get(wid, [])
            v *= 1.0 + sum(bump[:lv])
        return v


# =========================================================================
# PERKS
# =========================================================================
@dataclass
class Perk:
    pid: str
    name: str
    desc: str
    apply: object                      # (world) -> None
    weight: float = 1.0
    forbidden: bool = False
    sanity_cost: float = 0.0
    repeatable: bool = True
    tags: tuple = field(default_factory=tuple)


def _s(key, amount):
    return lambda w: w.player.stats.scale(key, amount)


def _a(key, amount):
    return lambda w: w.player.stats.add(key, amount)


def _tag(tag, amount):
    return lambda w: w.player.stats.scale_tag(tag, amount)


PERKS: list[Perk] = [
    Perk("firerate", "Rask finger", "+15 % skytehastighet", _s("fire_rate_mult", .15)),
    Perk("damage", "Tung hånd", "+15 % skade", _s("damage_mult", .15)),
    Perk("range", "Skarpt blikk", "+20 % rekkevidde", _s("range_mult", .20)),
    Perk("speed", "Lette føtter", "+12 % bevegelsesfart", _s("move_speed", .12)),
    Perk("hp", "Seigt kjøtt", "+25 maks HP, og fyll det opp",
         lambda w: (w.player.stats.add("max_hp", 25), w.player.heal(25))),
    Perk("regen", "Sakte gro", "+0,6 HP i sekundet", _a("hp_regen", .6)),
    Perk("luck", "Flaks", "+1 Luck. Bedre og hyppigere drops.", _a("luck", 1.0)),
    Perk("armor", "Skinnjakke", "+3 rustning (flat skadereduksjon)", _a("armor", 3.0)),
    Perk("crit", "Svakt punkt", "+8 % kritisk sjanse", _a("crit_chance", .08)),
    Perk("critmult", "Nådestøt", "+40 % kritisk skade", _a("crit_mult", .40)),
    Perk("area", "Vidt favntak", "+18 % områdestørrelse", _s("area_mult", .18)),
    Perk("magnet", "Grådighet", "+40 % oppsamlingsradius", _s("pickup_radius", .40)),
    Perk("dodge_cd", "Refleks", "-20 % dodge-nedkjøling", _s("dodge_cooldown", -.20)),
    Perk("dodge_dist", "Lange sprang", "+25 % dodge-lengde", _s("dodge_distance", .25)),
    Perk("blink", "BLINK", "Dodge blir øyeblikkelig teleportering med lengre rekkevidde.",
         lambda w: (setattr(w.player, "blink", True),
                    w.player.stats.scale("dodge_distance", .5)),
         weight=0.5, repeatable=False),
    Perk("fire_tag", "Pyroman", "+25 % ildskade", _tag("fire", .25), tags=("fire",)),
    Perk("frost_tag", "Iskaldt sinn", "+25 % frostskade", _tag("frost", .25), tags=("frost",)),
    Perk("bleed_tag", "Blodtørst", "+25 % blødningsskade", _tag("bleed", .25), tags=("bleed",)),
    Perk("void_tag", "Tomrommet lytter", "+25 % eldritch-skade", _tag("eldritch", .25),
         tags=("eldritch",)),
    Perk("phys_tag", "Ren mekanikk", "+25 % fysisk skade", _tag("physical", .25),
         tags=("physical",)),
    Perk("sanity_regen", "Fast grunn", "+0,8 SAN i sekundet", _a("sanity_regen", .8)),
    Perk("max_sanity", "Herdet psyke", "+25 maks SAN",
         lambda w: (w.player.stats.add("max_sanity", 25),
                    setattr(w.player, "sanity", w.player.sanity + 25))),
]

# Forbudte perks: sterkere, men koster sanity permanent (maks SAN faller).
FORBIDDEN: list[Perk] = [
    Perk("f_damage", "Blodpakt", "+40 % skade. -20 maks SAN.",
         lambda w: w.player.stats.scale("damage_mult", .40),
         forbidden=True, sanity_cost=20),
    Perk("f_speed", "Feberrus", "+35 % skytehastighet og +15 % fart. -25 maks SAN.",
         lambda w: (w.player.stats.scale("fire_rate_mult", .35),
                    w.player.stats.scale("move_speed", .15)),
         forbidden=True, sanity_cost=25),
    Perk("f_madness", "Klarsyn i mørket", "Skadebonusen fra lav SAN dobles. -15 maks SAN.",
         lambda w: setattr(w.player, "madness_scale", w.player.madness_scale * 2),
         forbidden=True, sanity_cost=15),
    Perk("f_thorns", "Hud av kroker", "Fiender som treffer deg tar 20 skade tilbake. -20 maks SAN.",
         lambda w: setattr(w.player, "thorns", w.player.thorns + 20),
         forbidden=True, sanity_cost=20),
    Perk("f_luck", "Ofring", "+3 Luck. -30 maks SAN.",
         lambda w: w.player.stats.add("luck", 3.0),
         forbidden=True, sanity_cost=30),
    Perk("f_corrupt", "Alt forderves", "Alle våpen påfører fordervelse. -25 maks SAN.",
         lambda w: setattr(w.player, "universal_corrupt", True),
         forbidden=True, sanity_cost=25, repeatable=False),
]

# =========================================================================
# ITEMS (drops)
# =========================================================================
# kind: passive | active | armor | weapon
ITEMS: dict[str, dict] = {
    "i_lens": dict(name="Sprukket linse", kind="passive", sprite="item_lens",
                   desc="+20 % rekkevidde, +5 % krit",
                   apply=lambda w: (w.player.stats.scale("range_mult", .20),
                                    w.player.stats.add("crit_chance", .05))),
    "i_heart": dict(name="Bankende ting", kind="passive", sprite="item_heart",
                    desc="+30 maks HP, +0,5 regen",
                    apply=lambda w: (w.player.stats.add("max_hp", 30),
                                     w.player.stats.add("hp_regen", .5))),
    "i_coal": dict(name="Evig glo", kind="passive", sprite="item_coal",
                   desc="+35 % ildskade, brann varer lenger",
                   apply=lambda w: (w.player.stats.scale_tag("fire", .35),
                                    setattr(w.player, "burn_bonus", w.player.burn_bonus + 2.0))),
    "i_talisman": dict(name="Talisman", kind="passive", sprite="item_talisman",
                       desc="+1,5 SAN-regen, +20 maks SAN",
                       apply=lambda w: (w.player.stats.add("sanity_regen", 1.5),
                                        w.player.stats.add("max_sanity", 20))),
    "i_boots": dict(name="Døde manns støvler", kind="passive", sprite="item_boots",
                    desc="+18 % fart, -15 % dodge-nedkjøling",
                    apply=lambda w: (w.player.stats.scale("move_speed", .18),
                                     w.player.stats.scale("dodge_cooldown", -.15))),
    # Rustning
    "a_leather": dict(name="Herdet lær", kind="armor", sprite="item_armor",
                      desc="+5 rustning",
                      apply=lambda w: w.player.stats.add("armor", 5.0)),
    "a_chitin": dict(name="Kitinplate", kind="armor", sprite="item_armor",
                     desc="+8 rustning, -6 % fart",
                     apply=lambda w: (w.player.stats.add("armor", 8.0),
                                      w.player.stats.scale("move_speed", -.06))),
    "a_shroud": dict(name="Likklede", kind="armor", sprite="item_armor",
                     desc="+4 rustning. Fiender som dør nær deg gir 1 SAN tilbake.",
                     apply=lambda w: (w.player.stats.add("armor", 4.0),
                                      setattr(w.player, "sanity_on_kill", 1.0))),
    # Aktive
    "x_blast": dict(name="Detonator", kind="active", sprite="item_blast",
                    desc="Sprenger alt rundt deg for 60 skade. 12 s nedkjøling.",
                    cooldown=12.0, effect="blast"),
    "x_freeze": dict(name="Stillstand", kind="active", sprite="item_freeze",
                     desc="Fryser alle fiender på skjermen i 3 s. 20 s nedkjøling.",
                     cooldown=20.0, effect="freeze"),
    "x_heal": dict(name="Laudanum", kind="active", sprite="item_heal",
                   desc="Gjenoppretter 40 HP, men koster 10 SAN. 18 s nedkjøling.",
                   cooldown=18.0, effect="heal"),
}

# =========================================================================
# BANER
# =========================================================================
# Hver wave: (fiendetype, antall, spawn-intervall, forsinkelse før start)
STAGES: list[dict] = [
    dict(name="I. Havnelageret", tint=(26, 30, 42), boss="boss_maw",
         waves=[("grunt", 14, 0.9, 0.0),
                ("runner", 10, 0.7, 12.0),
                ("grunt", 18, 0.6, 24.0),
                ("spitter", 6, 1.4, 34.0),
                ("brute", 3, 3.0, 44.0)]),
    dict(name="II. Under gaten", tint=(30, 24, 34), boss="boss_crawler",
         waves=[("runner", 16, 0.6, 0.0),
                ("spitter", 10, 1.0, 12.0),
                ("grunt", 24, 0.45, 22.0),
                ("wretch", 5, 2.4, 34.0),
                ("brute", 6, 2.2, 46.0)]),
    dict(name="III. Der geometrien svikter", tint=(22, 20, 40), boss="boss_eye",
         waves=[("wretch", 8, 1.6, 0.0),
                ("runner", 24, 0.4, 12.0),
                ("spitter", 14, 0.8, 24.0),
                ("brute", 10, 1.6, 36.0),
                ("wretch", 12, 1.2, 50.0)]),
]

STAGE_SCALE_HP = 0.55       # hvor mye fiende-HP øker per loop av banene
STAGE_SCALE_DMG = 0.30
