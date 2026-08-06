"""Alle tuning-tall samlet på ett sted. Ingen pygame-avhengigheter her."""

# Virtuell oppløsning. Spillet simuleres og tegnes her, og skaleres opp
# til skjermen. Gir ekte pixel-look og billig rendering på mobil.
VW, VH = 480, 270

ARENA_W, ARENA_H = 1600, 1200

# --- Spiller -------------------------------------------------------------
PLAYER_BASE = {
    "max_hp": 100.0,
    "hp_regen": 0.0,
    "move_speed": 78.0,
    "damage_mult": 1.0,
    "fire_rate_mult": 1.0,
    "range_mult": 1.0,
    "proj_speed_mult": 1.0,
    "area_mult": 1.0,
    "luck": 0.0,
    "armor": 0.0,
    "crit_chance": 0.05,
    "crit_mult": 2.0,
    "pickup_radius": 26.0,
    "dodge_cooldown": 3.0,
    "dodge_distance": 70.0,
    "dodge_iframes": 0.35,
    "max_sanity": 100.0,
    "sanity_regen": 0.4,
}

PLAYER_RADIUS = 5.0
CONTACT_TICK = 0.5          # sekunder mellom hver kontaktskade fra samme fiende
XP_MAGNET_SPEED = 190.0

# --- Progresjon ----------------------------------------------------------
def xp_to_next(level: int) -> int:
    """Litt brattere enn lineært, men aldri en vegg."""
    return int(5 + level * 4 + (level ** 1.5))


PERK_CHOICES = 3            # antall vanlige valg ved level up
FORBIDDEN_CHANCE = 0.35     # sjanse for at et fjerde, forbudt valg tilbys

# --- Sanity --------------------------------------------------------------
SANITY_DRAIN_RADIUS = 90.0  # nærhet til eldritch-fiender som tapper SAN
SANITY_DRAIN_RATE = 3.5     # SAN per sekund per eldritch-fiende i radius
SANITY_LOW = 0.5            # under denne andelen: fantomer begynner å spawne
SANITY_CRITICAL = 0.25      # under denne: skjermen forvrenges, skaden øker
MADNESS_DAMAGE_BONUS = 0.6  # maks skadebonus ved 0 SAN

# --- Statuseffekter ------------------------------------------------------
BURN_DPS = 6.0
BURN_DURATION = 3.0
CHILL_SLOW = 0.45           # 45 % saktere
CHILL_DURATION = 2.0
BLEED_DPS = 4.0
BLEED_DURATION = 4.0
CORRUPT_VULN = 0.30         # +30 % skade tatt
CORRUPT_DURATION = 5.0
CORRUPT_BLAST_DAMAGE = 22.0
CORRUPT_BLAST_RADIUS = 34.0
THERMAL_SHOCK_MULT = 2.2    # ild på nedkjølt fiende

# --- Drops ---------------------------------------------------------------
ELITE_DROP_CHANCE = 0.35
BOSS_DROP_COUNT = 2
HEAL_DROP_CHANCE = 0.12
