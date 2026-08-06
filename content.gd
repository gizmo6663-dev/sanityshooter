class_name Content
extends RefCounted

## Alt innhold som ren data. Nye våpen, perks, items, fiender og baner legges
## til her — world.gd skal aldri trenge endring for å utvide spillet.

# =========================================================================
# FIENDER
# =========================================================================
const ENEMIES := {
	"grunt": {"name": "Tjener", "hp": 14.0, "speed": 32.0, "damage": 6.0,
		"radius": 4.0, "xp": 1, "sprite": "grunt", "tags": []},
	"runner": {"name": "Hund", "hp": 9.0, "speed": 58.0, "damage": 5.0,
		"radius": 3.0, "xp": 1, "sprite": "runner", "tags": []},
	"brute": {"name": "Kadaver", "hp": 60.0, "speed": 20.0, "damage": 14.0,
		"radius": 7.0, "xp": 4, "sprite": "brute", "tags": [], "elite": true},
	"spitter": {"name": "Spytter", "hp": 26.0, "speed": 26.0, "damage": 9.0,
		"radius": 5.0, "xp": 3, "sprite": "spitter", "tags": [],
		"ranged": true, "shot_range": 120.0, "shot_cd": 2.2, "shot_speed": 70.0},
	"wretch": {"name": "Usling", "hp": 40.0, "speed": 30.0, "damage": 10.0,
		"radius": 5.0, "xp": 3, "sprite": "wretch", "tags": ["eldritch"],
		"elite": true},
	"phantom": {"name": "Fantom", "hp": 18.0, "speed": 44.0, "damage": 8.0,
		"radius": 4.0, "xp": 0, "sprite": "phantom",
		"tags": ["eldritch", "phantom"]},

	"boss_maw": {"name": "GAPET", "hp": 900.0, "speed": 34.0, "damage": 22.0,
		"radius": 13.0, "xp": 60, "sprite": "boss_maw", "tags": ["eldritch"],
		"boss": true},
	"boss_crawler": {"name": "KRYPET", "hp": 1500.0, "speed": 40.0,
		"damage": 26.0, "radius": 14.0, "xp": 90, "sprite": "boss_crawler",
		"tags": [], "boss": true, "ranged": true, "shot_range": 200.0,
		"shot_cd": 1.4, "shot_speed": 95.0},
	"boss_eye": {"name": "DET SOM SER", "hp": 2400.0, "speed": 30.0,
		"damage": 30.0, "radius": 15.0, "xp": 140, "sprite": "boss_eye",
		"tags": ["eldritch"], "boss": true, "ranged": true,
		"shot_range": 240.0, "shot_cd": 1.0, "shot_speed": 110.0},
}

# =========================================================================
# VÅPEN
# =========================================================================
# behavior: shot | spread | orbit | aura | beam | homing
# Hvert nivå i "levels" er en dict med desc + de bonusene nivået gir.
const WEAPONS := {
	"pistol": {
		"name": "Tjenestepistol", "behavior": "shot", "tag": "physical",
		"damage": 8.0, "cooldown": 0.55, "range": 130.0, "speed": 210.0,
		"count": 1, "pierce": 0, "spread": 0.0, "sprite": "bullet",
		"desc": "Pålitelig. Kjedelig. Treffer alltid nærmeste.",
		"levels": [
			{"desc": "+1 prosjektil", "count_add": 1},
			{"desc": "+40 % skade", "damage_mul": 0.40},
			{"desc": "+1 gjennomtrenging", "pierce_add": 1},
			{"desc": "-25 % ladetid", "cooldown_cut": 0.25},
			{"desc": "+2 prosjektiler", "count_add": 2},
		]},
	"shotgun": {
		"name": "Hagle", "behavior": "spread", "tag": "physical",
		"damage": 6.0, "cooldown": 1.1, "range": 90.0, "speed": 180.0,
		"count": 5, "pierce": 0, "spread": 0.55, "sprite": "bullet",
		"desc": "Fem hagl i en vifte. Elsker trange rom.",
		"levels": [
			{"desc": "+2 hagl", "count_add": 2},
			{"desc": "+35 % skade", "damage_mul": 0.35},
			{"desc": "-20 % ladetid", "cooldown_cut": 0.20},
			{"desc": "+50 % rekkevidde", "range_mul": 0.50},
			{"desc": "+3 hagl", "count_add": 3},
		]},
	"censer": {
		"name": "Røkelseskar", "behavior": "orbit", "tag": "fire",
		"damage": 9.0, "cooldown": 2.0, "range": 34.0, "speed": 2.6,
		"count": 2, "pierce": 99, "spread": 0.0, "sprite": "ember",
		"applies": "burn",
		"desc": "Brennende kar som kretser om deg. Antenner alt de rører.",
		"levels": [
			{"desc": "+1 kar", "count_add": 1},
			{"desc": "+40 % skade", "damage_mul": 0.40},
			{"desc": "+30 % bane", "range_mul": 0.30},
			{"desc": "+1 kar", "count_add": 1},
			{"desc": "+50 % rotasjonsfart", "speed_mul": 0.50},
		]},
	"frostlamp": {
		"name": "Frostlykt", "behavior": "aura", "tag": "frost",
		"damage": 4.0, "cooldown": 0.8, "range": 48.0, "speed": 0.0,
		"count": 1, "pierce": 99, "spread": 0.0, "sprite": "",
		"applies": "chill",
		"desc": "Kulden siver ut fra deg og gjør alt tregt.",
		"levels": [
			{"desc": "+40 % radius", "range_mul": 0.40},
			{"desc": "+50 % skade", "damage_mul": 0.50},
			{"desc": "-25 % pulsintervall", "cooldown_cut": 0.25},
			{"desc": "+40 % radius", "range_mul": 0.40},
			{"desc": "+60 % skade", "damage_mul": 0.60},
		]},
	"ripper": {
		"name": "Rivejern", "behavior": "shot", "tag": "bleed",
		"damage": 11.0, "cooldown": 0.9, "range": 70.0, "speed": 160.0,
		"count": 1, "pierce": 2, "spread": 0.15, "sprite": "shard",
		"applies": "bleed",
		"desc": "Roterende tenner. Ofrene forblør mens de går.",
		"levels": [
			{"desc": "+1 prosjektil", "count_add": 1},
			{"desc": "+45 % skade", "damage_mul": 0.45},
			{"desc": "+2 gjennomtrenging", "pierce_add": 2},
			{"desc": "-25 % ladetid", "cooldown_cut": 0.25},
			{"desc": "+60 % skade", "damage_mul": 0.60},
		]},
	"voidlance": {
		"name": "Tomromslanse", "behavior": "beam", "tag": "eldritch",
		"damage": 26.0, "cooldown": 1.8, "range": 200.0, "speed": 0.0,
		"count": 1, "pierce": 99, "spread": 0.0, "sprite": "",
		"applies": "corrupt",
		"desc": "En stråle av ingenting. Merker alt den treffer.",
		"levels": [
			{"desc": "+45 % skade", "damage_mul": 0.45},
			{"desc": "-25 % ladetid", "cooldown_cut": 0.25},
			{"desc": "+60 % rekkevidde", "range_mul": 0.60},
			{"desc": "+2 stråler", "count_add": 2},
			{"desc": "+50 % skade", "damage_mul": 0.50},
		]},
	"swarm": {
		"name": "Yngelsverm", "behavior": "homing", "tag": "eldritch",
		"damage": 7.0, "cooldown": 1.3, "range": 150.0, "speed": 120.0,
		"count": 3, "pierce": 0, "spread": 1.2, "sprite": "spawn",
		"desc": "Små ting du helst ikke ser på. De finner veien selv.",
		"levels": [
			{"desc": "+2 yngel", "count_add": 2},
			{"desc": "+40 % skade", "damage_mul": 0.40},
			{"desc": "+40 % fart", "speed_mul": 0.40},
			{"desc": "+3 yngel", "count_add": 3},
			{"desc": "+50 % skade", "damage_mul": 0.50},
		]},
}

const STARTER_WEAPON := "pistol"


## En instans av et våpen slik spilleren har det: id + nivå + nedkjøling.
class WeaponInst extends RefCounted:
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
		return "maks"

	## Summerer basisverdien med bonusene fra hvert nivå spilleren har tatt.
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
# PERKS
# =========================================================================
# Deklarative: add (flat), mul (prosent), tag (skadetype), flag (spesial).
const PERKS := [
	{"id": "firerate", "name": "Rask finger", "desc": "+15 % skytehastighet",
		"mul": {"fire_rate_mult": 0.15}},
	{"id": "damage", "name": "Tung hånd", "desc": "+15 % skade",
		"mul": {"damage_mult": 0.15}},
	{"id": "range", "name": "Skarpt blikk", "desc": "+20 % rekkevidde",
		"mul": {"range_mult": 0.20}},
	{"id": "speed", "name": "Lette føtter", "desc": "+12 % bevegelsesfart",
		"mul": {"move_speed": 0.12}},
	{"id": "hp", "name": "Seigt kjøtt", "desc": "+25 maks HP, og fyll det opp",
		"add": {"max_hp": 25.0}, "heal": 25.0},
	{"id": "regen", "name": "Sakte gro", "desc": "+0,6 HP i sekundet",
		"add": {"hp_regen": 0.6}},
	{"id": "luck", "name": "Flaks", "desc": "+1 Luck. Bedre og hyppigere drops.",
		"add": {"luck": 1.0}},
	{"id": "armor", "name": "Skinnjakke", "desc": "+3 rustning",
		"add": {"armor": 3.0}},
	{"id": "crit", "name": "Svakt punkt", "desc": "+8 % kritisk sjanse",
		"add": {"crit_chance": 0.08}},
	{"id": "critmult", "name": "Nådestøt", "desc": "+40 % kritisk skade",
		"add": {"crit_mult": 0.40}},
	{"id": "area", "name": "Vidt favntak", "desc": "+18 % områdestørrelse",
		"mul": {"area_mult": 0.18}},
	{"id": "magnet", "name": "Grådighet", "desc": "+40 % oppsamlingsradius",
		"mul": {"pickup_radius": 0.40}},
	{"id": "dodge_cd", "name": "Refleks", "desc": "-20 % dodge-nedkjøling",
		"mul": {"dodge_cooldown": -0.20}},
	{"id": "dodge_dist", "name": "Lange sprang", "desc": "+25 % dodge-lengde",
		"mul": {"dodge_distance": 0.25}},
	{"id": "blink", "name": "BLINK",
		"desc": "Dodge blir øyeblikkelig teleportering, og rekker lenger.",
		"flag": "blink", "mul": {"dodge_distance": 0.5}, "once": true},
	{"id": "fire_tag", "name": "Pyroman", "desc": "+25 % ildskade",
		"tag": {"fire": 0.25}, "needs_tag": "fire"},
	{"id": "frost_tag", "name": "Iskaldt sinn", "desc": "+25 % frostskade",
		"tag": {"frost": 0.25}, "needs_tag": "frost"},
	{"id": "bleed_tag", "name": "Blodtørst", "desc": "+25 % blødningsskade",
		"tag": {"bleed": 0.25}, "needs_tag": "bleed"},
	{"id": "void_tag", "name": "Tomrommet lytter", "desc": "+25 % eldritch-skade",
		"tag": {"eldritch": 0.25}, "needs_tag": "eldritch"},
	{"id": "phys_tag", "name": "Ren mekanikk", "desc": "+25 % fysisk skade",
		"tag": {"physical": 0.25}, "needs_tag": "physical"},
	{"id": "sanity_regen", "name": "Fast grunn", "desc": "+0,8 SAN i sekundet",
		"add": {"sanity_regen": 0.8}},
	{"id": "max_sanity", "name": "Herdet psyke", "desc": "+25 maks SAN",
		"add": {"max_sanity": 25.0}, "restore_sanity": 25.0},
]

## Forbudte perks: sterkere, men senker maks SAN permanent.
const FORBIDDEN := [
	{"id": "f_damage", "name": "Blodpakt", "desc": "+40 % skade. -20 maks SAN.",
		"mul": {"damage_mult": 0.40}, "sanity_cost": 20.0, "forbidden": true},
	{"id": "f_speed", "name": "Feberrus",
		"desc": "+35 % skytehastighet og +15 % fart. -25 maks SAN.",
		"mul": {"fire_rate_mult": 0.35, "move_speed": 0.15},
		"sanity_cost": 25.0, "forbidden": true},
	{"id": "f_madness", "name": "Klarsyn i mørket",
		"desc": "Skadebonusen fra lav SAN dobles. -15 maks SAN.",
		"flag": "madness_double", "sanity_cost": 15.0, "forbidden": true},
	{"id": "f_thorns", "name": "Hud av kroker",
		"desc": "Fiender som treffer deg tar 20 skade tilbake. -20 maks SAN.",
		"thorns": 20.0, "sanity_cost": 20.0, "forbidden": true},
	{"id": "f_luck", "name": "Ofring", "desc": "+3 Luck. -30 maks SAN.",
		"add": {"luck": 3.0}, "sanity_cost": 30.0, "forbidden": true},
	{"id": "f_corrupt", "name": "Alt forderves",
		"desc": "Alle våpen påfører fordervelse. -25 maks SAN.",
		"flag": "universal_corrupt", "sanity_cost": 25.0, "forbidden": true,
		"once": true},
]

# =========================================================================
# ITEMS
# =========================================================================
# kind: passive | armor | active
const ITEMS := {
	"i_lens": {"name": "Sprukket linse", "kind": "passive", "sprite": "item_lens",
		"desc": "+20 % rekkevidde, +5 % krit",
		"mul": {"range_mult": 0.20}, "add": {"crit_chance": 0.05}},
	"i_heart": {"name": "Bankende ting", "kind": "passive", "sprite": "item_heart",
		"desc": "+30 maks HP, +0,5 regen",
		"add": {"max_hp": 30.0, "hp_regen": 0.5}},
	"i_coal": {"name": "Evig glo", "kind": "passive", "sprite": "item_coal",
		"desc": "+35 % ildskade, brann varer lenger",
		"tag": {"fire": 0.35}, "burn_bonus": 2.0},
	"i_talisman": {"name": "Talisman", "kind": "passive", "sprite": "item_talisman",
		"desc": "+1,5 SAN-regen, +20 maks SAN",
		"add": {"sanity_regen": 1.5, "max_sanity": 20.0}},
	"i_boots": {"name": "Døde manns støvler", "kind": "passive",
		"sprite": "item_boots", "desc": "+18 % fart, -15 % dodge-nedkjøling",
		"mul": {"move_speed": 0.18, "dodge_cooldown": -0.15}},

	"a_leather": {"name": "Herdet lær", "kind": "armor", "sprite": "item_armor",
		"desc": "+5 rustning", "add": {"armor": 5.0}},
	"a_chitin": {"name": "Kitinplate", "kind": "armor", "sprite": "item_armor",
		"desc": "+8 rustning, -6 % fart",
		"add": {"armor": 8.0}, "mul": {"move_speed": -0.06}},
	"a_shroud": {"name": "Likklede", "kind": "armor", "sprite": "item_armor",
		"desc": "+4 rustning. Fiender som dør nær deg gir 1 SAN tilbake.",
		"add": {"armor": 4.0}, "sanity_on_kill": 1.0},

	"x_blast": {"name": "Detonator", "kind": "active", "sprite": "item_blast",
		"desc": "Sprenger alt rundt deg for 60 skade. 12 s nedkjøling.",
		"cooldown": 12.0, "effect": "blast"},
	"x_freeze": {"name": "Stillstand", "kind": "active", "sprite": "item_freeze",
		"desc": "Fryser alle fiender i 3 s. 20 s nedkjøling.",
		"cooldown": 20.0, "effect": "freeze"},
	"x_heal": {"name": "Laudanum", "kind": "active", "sprite": "item_heal",
		"desc": "Gjenoppretter 40 HP, koster 10 SAN. 18 s nedkjøling.",
		"cooldown": 18.0, "effect": "heal"},
}

# =========================================================================
# BANER
# =========================================================================
# waves: [fiendetype, antall, intervall, forsinkelse]
const STAGES := [
	{"name": "I. Havnelageret", "tint": Color(0.10, 0.12, 0.16),
		"boss": "boss_maw",
		"waves": [["grunt", 14, 0.9, 0.0], ["runner", 10, 0.7, 12.0],
			["grunt", 18, 0.6, 24.0], ["spitter", 6, 1.4, 34.0],
			["brute", 3, 3.0, 44.0]]},
	{"name": "II. Under gaten", "tint": Color(0.12, 0.09, 0.13),
		"boss": "boss_crawler",
		"waves": [["runner", 16, 0.6, 0.0], ["spitter", 10, 1.0, 12.0],
			["grunt", 24, 0.45, 22.0], ["wretch", 5, 2.4, 34.0],
			["brute", 6, 2.2, 46.0]]},
	{"name": "III. Der geometrien svikter", "tint": Color(0.09, 0.08, 0.16),
		"boss": "boss_eye",
		"waves": [["wretch", 8, 1.6, 0.0], ["runner", 24, 0.4, 12.0],
			["spitter", 14, 0.8, 24.0], ["brute", 10, 1.6, 36.0],
			["wretch", 12, 1.2, 50.0]]},
]
