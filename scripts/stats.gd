class_name StatBlock
extends RefCounted

## Statblokk med flate og prosentvise modifikatorer, pluss skademultiplikator
## per skadetype. Alt regnes ut på nytt ved endring, så ingenting drifter.

var base: Dictionary = {}
var flat: Dictionary = {}
var mult: Dictionary = {}
var tag_mult: Dictionary = {}
var _cache: Dictionary = {}


func _init() -> void:
	base = Cfg.PLAYER_BASE.duplicate(true)


func add(key: String, value: float) -> void:
	flat[key] = float(flat.get(key, 0.0)) + value
	_cache.clear()


func scale(key: String, factor: float) -> void:
	## factor 0.2 = +20 %, -0.15 = -15 %
	mult[key] = float(mult.get(key, 0.0)) + factor
	_cache.clear()


func scale_tag(tag: String, factor: float) -> void:
	tag_mult[tag] = float(tag_mult.get(tag, 0.0)) + factor
	_cache.clear()


func get_stat(key: String) -> float:
	if _cache.has(key):
		return _cache[key]
	var v := float(base.get(key, 0.0)) + float(flat.get(key, 0.0))
	v *= 1.0 + float(mult.get(key, 0.0))
	_cache[key] = v
	return v


func tag(t: String) -> float:
	return 1.0 + float(tag_mult.get(t, 0.0))
