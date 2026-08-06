class_name Cfg
extends RefCounted

## Alle tuning-tall samlet. Start her når noe føles feil.

const VW := 480
const VH := 270

const ARENA_W := 1600.0
const ARENA_H := 1200.0

const PLAYER_BASE := {
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

const PLAYER_RADIUS := 5.0
const CONTACT_TICK := 0.5
const XP_MAGNET_SPEED := 190.0

const PERK_CHOICES := 3
const FORBIDDEN_CHANCE := 0.35

# Sanity
const SANITY_DRAIN_RADIUS := 90.0
const SANITY_DRAIN_RATE := 3.5
const SANITY_LOW := 0.5
const SANITY_CRITICAL := 0.25
const MADNESS_DAMAGE_BONUS := 0.6

# Statuseffekter
const BURN_DPS := 6.0
const BURN_DURATION := 3.0
const CHILL_SLOW := 0.45
const CHILL_DURATION := 2.0
const BLEED_DPS := 4.0
const BLEED_DURATION := 4.0
const CORRUPT_VULN := 0.30
const CORRUPT_DURATION := 5.0
const CORRUPT_BLAST_DAMAGE := 22.0
const CORRUPT_BLAST_RADIUS := 34.0
const THERMAL_SHOCK_MULT := 2.2

# Sanity fra drap — insentiverer aggressivt spill i stedet for å flykte.
const SANITY_KILL_NORMAL := 0.6
const SANITY_KILL_ELITE := 2.5
const SANITY_KILL_BOSS := 12.0
const SANITY_KILL_PHANTOM := 2.0

# Drops
const ELITE_DROP_CHANCE := 0.35
const BOSS_DROP_COUNT := 2
const HEAL_DROP_CHANCE := 0.12

const STAGE_SCALE_HP := 0.55
const STAGE_SCALE_DMG := 0.30


static func xp_to_next(level: int) -> int:
	return int(5 + level * 4 + pow(float(level), 1.5))
