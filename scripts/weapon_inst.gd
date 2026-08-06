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
