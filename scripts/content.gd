class_name Content
extends RefCounted

## All content as pure data. New weapons, perks, items, enemies and stages are
## added here — world.gd never needs to change to extend the game.

# =========================================================================
# ENEMIES
# =========================================================================
const ENEMIES := {
	"grunt": {"name": "Grunt", "hp": 14.0, "speed": 32.0, "damage": 6.0,
		"radius": 4.0, "xp": 1, "sprite": "grunt", "tags": []},
	"runner": {"name": "Runner", "hp": 9.0, "speed": 58.0, "damage": 5.0,
		"radius": 3.0, "xp": 1, "sprite": "runner", "tags": []},
	"brute": {"name": "Brute", "hp": 60.0, "speed": 20.0, "damage": 14.0,
		"radius": 7.0, "xp": 4, "sprite": "brute", "tags": [], "elite": true},
	"spitter": {"name": "Spitter", "hp": 26.0, "speed": 26.0, "damage": 9.0,
		"radius": 5.0, "xp": 3, "sprite": "spitter", "tags": [],
		"ranged": true, "shot_range": 120.0, "shot_cd": 2.2, "shot_speed": 70.0},
	"wretch": {"name": "Wretch", "hp": 40.0, "speed": 30.0, "damage": 10.0,
		"radius": 5.0, "xp": 3, "sprite": "wretch", "tags": ["eldritch"],
		"elite": true},
	"phantom": {"name": "Phantom", "hp": 18.0, "speed": 44.0, "damage": 8.0,
		"radius": 4.0, "xp": 0, "sprite": "phantom",
		"tags": ["eldritch", "phantom"]},

	"boss_maw": {"name": "THE MAW", "hp": 900.0, "speed": 34.0, "damage": 22.0,
		"radius": 13.0, "xp": 60, "sprite": "boss_maw", "tags": ["eldritch"],
		"boss": true},
	"boss_crawler": {"name": "THE CRAWLER", "hp": 1500.0, "speed": 40.0,
		"damage": 26.0, "radius": 14.0, "xp": 90, "sprite": "boss_crawler",
		"tags": [], "boss": true, "ranged": true, "shot_range": 200.0,
		"shot_cd": 1.4, "shot_speed": 95.0},
	"boss_eye": {"name": "THAT WHICH SEES", "hp": 2400.0, "speed": 30.0,
		"damage": 30.0, "radius": 15.0, "xp": 140, "sprite": "boss_eye",
		"tags": ["eldritch"], "boss": true, "ranged": true,
		"shot_range": 240.0, "shot_cd": 1.0, "shot_speed": 110.0},
}

# =========================================================================
# WEAPONS
# =========================================================================
const WEAPONS := {
	"pistol": {
		"name": "Service Pistol", "behavior": "shot", "tag": "physical",
		"damage": 8.0, "cooldown": 0.55, "range": 130.0, "speed": 210.0,
		"count": 1, "pierce": 0, "spread": 0.0, "sprite": "bullet",
		"desc": "Reliable. Boring. Always hits the nearest.",
		"levels": [
			{"desc": "+1 projectile", "count_add": 1},
			{"desc": "+40 % damage", "damage_mul": 0.40},
			{"desc": "+1 piercing", "pierce_add": 1},
			{"desc": "-25 % cooldown", "cooldown_cut": 0.25},
			{"desc": "+2 projectiles", "count_add": 2},
		]},
	"shotgun": {
		"name": "Shotgun", "behavior": "spread", "tag": "physical",
		"damage": 6.0, "cooldown": 1.1, "range": 90.0, "speed": 180.0,
		"count": 5, "pierce": 0, "spread": 0.55, "sprite": "bullet",
		"desc": "Five pellets in a fan. Loves tight spaces.",
		"levels": [
			{"desc": "+2 pellets", "count_add": 2},
			{"desc": "+35 % damage", "damage_mul": 0.35},
			{"desc": "-20 % cooldown", "cooldown_cut": 0.20},
			{"desc": "+50 % range", "range_mul": 0.50},
			{"desc": "+3 pellets", "count_add": 3},
		]},
	"censer": {
		"name": "Censer", "behavior": "orbit", "tag": "fire",
		"damage": 9.0, "cooldown": 2.0, "range": 34.0, "speed": 2.6,
		"count": 2, "pierce": 99, "spread": 0.0, "sprite": "ember",
		"applies": "burn",
		"desc": "Burning vessels orbit you. Sets everything they touch ablaze.",
		"levels": [
			{"desc": "+1 vessel", "count_add": 1},
			{"desc": "+40 % damage", "damage_mul": 0.40},
			{"desc": "+30 % radius", "range_mul": 0.30},
			{"desc": "+1 vessel", "count_add": 1},
			{"desc": "+50 % rotation speed", "speed_mul": 0.50},
		]},
	"frostlamp": {
		"name": "Frost Lamp", "behavior": "aura", "tag": "frost",
		"damage": 4.0, "cooldown": 0.8, "range": 48.0, "speed": 0.0,
		"count": 1, "pierce": 99, "spread": 0.0, "sprite": "",
		"applies": "chill",
		"desc": "Cold seeps from you, slowing everything around.",
		"levels": [
			{"desc": "+40 % radius", "range_mul": 0.40},
			{"desc": "+50 % damage", "damage_mul": 0.50},
			{"desc": "-25 % pulse interval", "cooldown_cut": 0.25},
			{"desc": "+40 % radius", "range_mul": 0.40},
			{"desc": "+60 % damage", "damage_mul": 0.60},
		]},
	"ripper": {
		"name": "Ripper", "behavior": "shot", "tag": "bleed",
		"damage": 11.0, "cooldown": 0.9, "range": 70.0, "speed": 160.0,
		"count": 1, "pierce": 2, "spread": 0.15, "sprite": "shard",
		"applies": "bleed",
		"desc": "Spinning teeth. Victims bleed out as they walk.",
		"levels": [
			{"desc": "+1 projectile", "count_add": 1},
			{"desc": "+45 % damage", "damage_mul": 0.45},
			{"desc": "+2 piercing", "pierce_add": 2},
			{"desc": "-25 % cooldown", "cooldown_cut": 0.25},
			{"desc": "+60 % damage", "damage_mul": 0.60},
		]},
	"voidlance": {
		"name": "Void Lance", "behavior": "beam", "tag": "eldritch",
		"damage": 26.0, "cooldown": 1.8, "range": 200.0, "speed": 0.0,
		"count": 1, "pierce": 99, "spread": 0.0, "sprite": "",
		"applies": "corrupt",
		"desc": "A beam of nothingness. Brands everything it touches.",
		"levels": [
			{"desc": "+45 % damage", "damage_mul": 0.45},
			{"desc": "-25 % cooldown", "cooldown_cut": 0.25},
			{"desc": "+60 % range", "range_mul": 0.60},
			{"desc": "+2 beams", "count_add": 2},
			{"desc": "+50 % damage", "damage_mul": 0.50},
		]},
	"chainbolt": {
		"name": "Chain Lightning", "behavior": "chain", "tag": "shock",
		"damage": 10.0, "cooldown": 1.0, "range": 110.0, "speed": 0.0,
		"count": 3, "pierce": 0, "spread": 0.0, "sprite": "",
		"desc": "Jumps between enemies, weaker each hop. Reaches further from chilled targets.",
		"levels": [
			{"desc": "+2 jumps", "count_add": 2},
			{"desc": "+40 % damage", "damage_mul": 0.40},
			{"desc": "+30 % range", "range_mul": 0.30},
			{"desc": "+2 jumps", "count_add": 2},
			{"desc": "+50 % damage", "damage_mul": 0.50},
		]},
	"flamethrower": {
		"name": "Flamethrower", "behavior": "cone", "tag": "fire",
		"damage": 5.0, "cooldown": 0.35, "range": 60.0, "speed": 0.0,
		"count": 1, "pierce": 99, "spread": 0.9, "sprite": "",
		"applies": "burn",
		"desc": "Cone of flames in your movement direction. Sets everything ablaze.",
		"levels": [
			{"desc": "+40 % damage", "damage_mul": 0.40},
			{"desc": "+30 % range", "range_mul": 0.30},
			{"desc": "-25 % cooldown", "cooldown_cut": 0.25},
			{"desc": "+50 % damage", "damage_mul": 0.50},
			{"desc": "+40 % range", "range_mul": 0.40},
		]},
	"swarm": {
		"name": "Brood Swarm", "behavior": "homing", "tag": "eldritch",
		"damage": 7.0, "cooldown": 1.3, "range": 150.0, "speed": 120.0,
		"count": 3, "pierce": 0, "spread": 1.2, "sprite": "spawn",
		"desc": "Small things you'd rather not look at. They find their own way.",
		"levels": [
			{"desc": "+2 spawn", "count_add": 2},
			{"desc": "+40 % damage", "damage_mul": 0.40},
			{"desc": "+40 % speed", "speed_mul": 0.40},
			{"desc": "+3 spawn", "count_add": 3},
			{"desc": "+50 % damage", "damage_mul": 0.50},
		]},
}

const STARTER_WEAPON := "pistol"

# =========================================================================
# WEAPON INSTANCE CLASS (moved out to avoid nested class issues)
# =========================================================================
class_name WeaponInst
extends RefCounted

var wid: String
var level: int = 1
var timer: float = 0.0
var orbit_phase: float = 0.0

func _init(id: String) -> void:
	wid = id

func data() -> Dictionary:
	return Content.WEAPONS[wid]

func wname() -> String:
	return data()["name"]

func maxed() -> bool:
	return level > (data()["levels"] as Array).size()

func next_desc() -> String:
	var lv: Array = data()["levels"]
	if level - 1 < lv.size():
		return lv[level - 1]["desc"]
	return "max"

func stat(key: String) -> float:
	var d := data()
	var v := float(d.get(key, 0.0))
	var lv: Array = d["levels"]
	var taken: int = min(level - 1, lv.size())
	var dmg_mul := 0.0
	var cd_cut := 0.0
	var rng_mul := 0.0
	var spd_mul := 0.0
	var cnt_add := 0.0
	var prc_add := 0.0
	for i in range(taken):
		var b: Dictionary = lv[i]
		dmg_mul += float(b.get("damage_mul", 0.0))
		cd_cut += float(b.get("cooldown_cut", 0.0))
		rng_mul += float(b.get("range_mul", 0.0))
		spd_mul += float(b.get("speed_mul", 0.0))
		cnt_add += float(b.get("count_add", 0.0))
		prc_add += float(b.get("pierce_add", 0.0))
	match key:
		"damage": v *= 1.0 + dmg_mul
		"cooldown": v *= max(0.15, 1.0 - cd_cut)
		"range": v *= 1.0 + rng_mul
		"speed": v *= 1.0 + spd_mul
		"count": v += cnt_add
		"pierce": v += prc_add
	return v

# =========================================================================
# PERKS (normal)
# =========================================================================
const PERKS := [
	{"id": "firerate", "name": "Quick Trigger", "desc": "+15 % fire rate",
		"mul": {"fire_rate_mult": 0.15}},
	{"id": "damage", "name": "Heavy Hand", "desc": "+15 % damage",
		"mul": {"damage_mult": 0.15}},
	{"id": "range", "name": "Keen Eye", "desc": "+20 % range",
		"mul": {"range_mult": 0.20}},
	{"id": "speed", "name": "Light Feet", "desc": "+12 % move speed",
		"mul": {"move_speed": 0.12}},
	{"id": "hp", "name": "Tough Flesh", "desc": "+25 max HP, and heal that much",
		"add": {"max_hp": 25.0}, "heal": 25.0},
	{"id": "regen", "name": "Slow Growth", "desc": "+0.6 HP per second",
		"add": {"hp_regen": 0.6}},
	{"id": "luck", "name": "Luck", "desc": "+1 Luck. Better and more frequent drops.",
		"add": {"luck": 1.0}},
	{"id": "armor", "name": "Leather Jacket", "desc": "+3 armor",
		"add": {"armor": 3.0}},
	{"id": "crit", "name": "Weak Spot", "desc": "+8 % critical chance",
		"add": {"crit_chance": 0.08}},
	{"id": "critmult", "name": "Coup de Grâce", "desc": "+40 % critical damage",
		"add": {"crit_mult": 0.40}},
	{"id": "area", "name": "Wide Embrace", "desc": "+18 % area size",
		"mul": {"area_mult": 0.18}},
	{"id": "magnet", "name": "Greed", "desc": "+40 % pickup radius",
		"mul": {"pickup_radius": 0.40}},
	{"id": "dodge_cd", "name": "Reflex", "desc": "-20 % dodge cooldown",
		"mul": {"dodge_cooldown": -0.20}},
	{"id": "dodge_dist", "name": "Long Strides", "desc": "+25 % dodge distance",
		"mul": {"dodge_distance": 0.25}},
	{"id": "blink", "name": "BLINK",
		"desc": "Dodge becomes instant teleport, and goes farther.",
		"flag": "blink", "mul": {"dodge_distance": 0.5}, "once": true},
	{"id": "fire_tag", "name": "Pyromaniac", "desc": "+25 % fire damage",
		"tag": {"fire": 0.25}, "needs_tag": "fire"},
	{"id": "frost_tag", "name": "Cold Mind", "desc": "+25 % frost damage",
		"tag": {"frost": 0.25}, "needs_tag": "frost"},
	{"id": "bleed_tag", "name": "Bloodthirst", "desc": "+25 % bleed damage",
		"tag": {"bleed": 0.25}, "needs_tag": "bleed"},
	{"id": "void_tag", "name": "The Void Listens", "desc": "+25 % eldritch damage",
		"tag": {"eldritch": 0.25}, "needs_tag": "eldritch"},
	{"id": "phys_tag", "name": "Pure Mechanics", "desc": "+25 % physical damage",
		"tag": {"physical": 0.25}, "needs_tag": "physical"},
	{"id": "shock_tag", "name": "Conductive Mind", "desc": "+25 % shock damage",
		"tag": {"shock": 0.25}, "needs_tag": "shock"},
	{"id": "sanity_regen", "name": "Firm Ground", "desc": "+0.8 SAN per second",
		"add": {"sanity_regen": 0.8}},
	{"id": "max_sanity", "name": "Tempered Psyche", "desc": "+25 max SAN",
		"add": {"max_sanity": 25.0}, "restore_sanity": 25.0},

	# New buff perks
	{"id": "vampire", "name": "Blood Drinker",
		"desc": "Killing an enemy restores 2 HP (1 for phantom).",
		"add": {"hp_on_kill": 2.0}, "once": true},
	{"id": "haste", "name": "Adrenaline",
		"desc": "+10 % move speed, +10 % fire rate",
		"mul": {"move_speed": 0.10, "fire_rate_mult": 0.10}},
	{"id": "fortify", "name": "Fortify",
		"desc": "+5 armor, +10 % max HP",
		"add": {"armor": 5.0}, "mul": {"max_hp": 0.10}},
	{"id": "lifesteal", "name": "Leech",
		"desc": "5 % of damage dealt is restored as HP (min 1).",
		"flag": "lifesteal", "once": true},
]

## Forbidden perks: stronger, but permanently lower max SAN.
const FORBIDDEN := [
	{"id": "f_damage", "name": "Blood Pact", "desc": "+40 % damage. -20 max SAN.",
		"mul": {"damage_mult": 0.40}, "sanity_cost": 20.0, "forbidden": true},
	{"id": "f_speed", "name": "Fever Rush",
		"desc": "+35 % fire rate and +15 % speed. -25 max SAN.",
		"mul": {"fire_rate_mult": 0.35, "move_speed": 0.15},
		"sanity_cost": 25.0, "forbidden": true},
	{"id": "f_madness", "name": "Clarity in Darkness",
		"desc": "Damage bonus from low SAN doubles. -15 max SAN.",
		"flag": "madness_double", "sanity_cost": 15.0, "forbidden": true},
	{"id": "f_thorns", "name": "Skin of Hooks",
		"desc": "Enemies that hit you take 20 damage back. -20 max SAN.",
		"thorns": 20.0, "sanity_cost": 20.0, "forbidden": true},
	{"id": "f_luck", "name": "Sacrifice", "desc": "+3 Luck. -30 max SAN.",
		"add": {"luck": 3.0}, "sanity_cost": 30.0, "forbidden": true},
	{"id": "f_corrupt", "name": "All Corrupts",
		"desc": "All weapons apply corruption. -25 max SAN.",
		"flag": "universal_corrupt", "sanity_cost": 25.0, "forbidden": true,
		"once": true},

	# New forbidden perks
	{"id": "f_berserk", "name": "Berserker",
		"desc": "+50 % damage when below 30 % HP. -20 max SAN.",
		"berserk_bonus": 0.50, "sanity_cost": 20.0, "forbidden": true},
	{"id": "f_void", "name": "Embrace the Void",
		"desc": "+25 % eldritch damage, +15 % range. -30 max SAN.",
		"mul": {"range_mult": 0.15}, "tag": {"eldritch": 0.25},
		"sanity_cost": 30.0, "forbidden": true},
	{"id": "f_glass", "name": "Glass Soul",
		"desc": "+60 % damage, -40 % max HP. -10 max SAN.",
		"mul": {"damage_mult": 0.60, "max_hp": -0.40},
		"sanity_cost": 10.0, "forbidden": true},
]

# =========================================================================
# ITEMS
# =========================================================================
const ITEMS := {
	"i_lens": {"name": "Cracked Lens", "kind": "passive", "sprite": "item_lens",
		"desc": "+20 % range, +5 % crit",
		"mul": {"range_mult": 0.20}, "add": {"crit_chance": 0.05}},
	"i_heart": {"name": "Thumping Thing", "kind": "passive", "sprite": "item_heart",
		"desc": "+30 max HP, +0.5 regen",
		"add": {"max_hp": 30.0, "hp_regen": 0.5}},
	"i_coal": {"name": "Eternal Ember", "kind": "passive", "sprite": "item_coal",
		"desc": "+35 % fire damage, burn lasts longer",
		"tag": {"fire": 0.35}, "burn_bonus": 2.0},
	"i_talisman": {"name": "Talisman", "kind": "passive", "sprite": "item_talisman",
		"desc": "+1.5 SAN regen, +20 max SAN",
		"add": {"sanity_regen": 1.5, "max_sanity": 20.0}},
	"i_boots": {"name": "Dead Man's Boots", "kind": "passive",
		"sprite": "item_boots", "desc": "+18 % speed, -15 % dodge cooldown",
		"mul": {"move_speed": 0.18, "dodge_cooldown": -0.15}},

	"i_glasscannon": {"name": "Glass Heart", "kind": "passive", "sprite": "item_glass",
		"desc": "+55 % damage, -30 % max HP. All or nothing.",
		"mul": {"damage_mult": 0.55, "max_hp": -0.30}},
	"i_bulwark": {"name": "Bulwark Core", "kind": "passive", "sprite": "item_tank",
		"desc": "+45 % max HP, -20 % damage. Stand firm.",
		"mul": {"max_hp": 0.45, "damage_mult": -0.20}},
	"i_zerk": {"name": "Mark of Wrath", "kind": "passive", "sprite": "item_zerk",
		"desc": "+35 % damage while below 50 % HP.",
		"berserk_bonus": 0.35},
	"i_haste": {"name": "Overclocked Feather", "kind": "passive", "sprite": "item_haste",
		"desc": "+35 % fire rate, -18 % damage.",
		"mul": {"fire_rate_mult": 0.35, "damage_mult": -0.18}},
	"i_wildfire": {"name": "Wildfire", "kind": "passive", "sprite": "item_wildfire",
		"desc": "+30 % area size. Weapons without own effect ignite instead.",
		"mul": {"area_mult": 0.30}, "flag": "universal_burn"},

	"a_leather": {"name": "Tanned Leather", "kind": "armor", "sprite": "item_armor",
		"desc": "+5 armor", "add": {"armor": 5.0}},
	"a_chitin": {"name": "Chitin Plate", "kind": "armor", "sprite": "item_armor",
		"desc": "+8 armor, -6 % speed",
		"add": {"armor": 8.0}, "mul": {"move_speed": -0.06}},
	"a_shroud": {"name": "Shroud", "kind": "armor", "sprite": "item_armor",
		"desc": "+4 armor. Enemies dying near you restore 1 SAN.",
		"add": {"armor": 4.0}, "sanity_on_kill": 1.0},

	"x_blast": {"name": "Detonator", "kind": "active", "sprite": "item_blast",
		"desc": "Blast everything around you for 60 damage. 12 s cooldown.",
		"cooldown": 12.0, "effect": "blast"},
	"x_freeze": {"name": "Stasis", "kind": "active", "sprite": "item_freeze",
		"desc": "Freeze all enemies for 3 s. 20 s cooldown.",
		"cooldown": 20.0, "effect": "freeze"},
	"x_heal": {"name": "Laudanum", "kind": "active", "sprite": "item_heal",
		"desc": "Restore 40 HP, costs 10 SAN. 18 s cooldown.",
		"cooldown": 18.0, "effect": "heal"},
}

# =========================================================================
# STAGES (adjusted: intervals reduced to 2/3, grunt count doubled, others +50%)
# =========================================================================
const STAGES := [
	{"name": "I. Dockside Warehouse", "tint": Color(0.10, 0.12, 0.16),
		"boss": "boss_maw",
		"waves": [
			["grunt", 28, 0.6, 0.0],
			["runner", 15, 0.47, 12.0],
			["grunt", 36, 0.4, 24.0],
			["spitter", 9, 0.93, 34.0],
			["brute", 5, 2.0, 44.0]
		]},
	{"name": "II. Beneath the Streets", "tint": Color(0.12, 0.09, 0.13),
		"boss": "boss_crawler",
		"waves": [
			["runner", 24, 0.4, 0.0],
			["spitter", 15, 0.67, 12.0],
			["grunt", 48, 0.3, 22.0],
			["wretch", 8, 1.6, 34.0],
			["brute", 9, 1.47, 46.0]
		]},
	{"name": "III. Where Geometry Fails", "tint": Color(0.09, 0.08, 0.16),
		"boss": "boss_eye",
		"waves": [
			["wretch", 12, 1.07, 0.0],
			["runner", 36, 0.27, 12.0],
			["spitter", 21, 0.53, 24.0],
			["brute", 15, 1.07, 36.0],
			["wretch", 18, 0.8, 50.0]
		]},
]
