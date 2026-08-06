class_name World
extends RefCounted

## Hele simuleringen. Ingen tegning, ingen noder, ingen input-håndtering —
## bare tilstand og regler. game.gd leser denne og tegner det den finner.

# =========================================================================
# Inner classes
# =========================================================================
class Player extends RefCounted:
	var pos: Vector2
	var radius: float = Cfg.PLAYER_RADIUS
	var stats: StatBlock
	var hp: float
	var sanity: float
	var level: int = 1
	var xp: int = 0
	var xp_need: int
	var weapons: Array = []
	var items: Array = []
	var active_item: String = ""
	var active_cd: float = 0.0
	var facing: Vector2 = Vector2(0, 1)
	var dodge_timer: float = 0.0
	var iframes: float = 0.0
	var dash_vel: Vector2 = Vector2.ZERO
	var dash_time: float = 0.0
	var blink: bool = false
	var thorns: float = 0.0
	var madness_scale: float = 1.0
	var universal_corrupt: bool = false
	var universal_burn: bool = false
	var berserk_bonus: float = 0.0
	var burn_bonus: float = 0.0
	var sanity_on_kill: float = 0.0
	var hp_on_kill: float = 0.0
	var lifesteal: bool = false
	var taken_perks: Dictionary = {}

	func _init(p: Vector2) -> void:
		pos = p
		stats = StatBlock.new()
		hp = stats.get_stat("max_hp")
		sanity = stats.get_stat("max_sanity")
		xp_need = Cfg.xp_to_next(1)
		weapons.append(WeaponInst.new(Content.STARTER_WEAPON))

	func max_hp() -> float:
		return stats.get_stat("max_hp")

	func max_sanity() -> float:
		return max(10.0, stats.get_stat("max_sanity"))

	func sanity_frac() -> float:
		return clamp(sanity / max_sanity(), 0.0, 1.0)

	func madness_bonus() -> float:
		return (1.0 - sanity_frac()) * Cfg.MADNESS_DAMAGE_BONUS * madness_scale

	func heal(amount: float) -> void:
		hp = min(max_hp(), hp + amount)


class Enemy extends RefCounted:
	var uid: int
	var kind: String
	var data: Dictionary
	var pos: Vector2
	var radius: float
	var max_hp: float
	var hp: float
	var damage: float
	var speed: float
	var contact_timer: float = 0.0
	var shot_timer: float = 0.0
	var statuses: Dictionary = {}
	var freeze: float = 0.0
	var flash: float = 0.0
	var knock: Vector2 = Vector2.ZERO
	var alive: bool = true

	func _init(k: String, p: Vector2, hp_mul: float, dmg_mul: float, id: int) -> void:
		uid = id
		kind = k
		data = Content.ENEMIES[k]
		pos = p
		radius = data["radius"]
		max_hp = float(data["hp"]) * hp_mul
		hp = max_hp
		damage = float(data["damage"]) * dmg_mul
		speed = data["speed"]
		shot_timer = randf_range(0.3, 1.5)

	func is_boss() -> bool:
		return data.get("boss", false)

	func is_elite() -> bool:
		return data.get("elite", false)

	func is_phantom() -> bool:
		return "phantom" in (data["tags"] as Array)

	func is_eldritch() -> bool:
		return "eldritch" in (data["tags"] as Array)


class Projectile extends RefCounted:
	var pos: Vector2
	var vel: Vector2
	var radius: float
	var damage: float
	var tag: String
	var pierce: int
	var life: float
	var sprite: String
	var applies: String = ""
	var orbit: bool = false
	var orbit_radius: float = 0.0
	var orbit_angle: float = 0.0
	var orbit_speed: float = 0.0
	var homing: bool = false
	var target: Enemy = null
	var hit_times: Dictionary = {}
	var age: float = 0.0


class Pickup extends RefCounted:
	var pos: Vector2
	var kind: String        # xp | heal | item
	var value: int = 0
	var payload: Dictionary = {}
	var vel: Vector2
	var age: float = 0.0

	func _init(p: Vector2, k: String) -> void:
		pos = p
		kind = k
		vel = Vector2(randf_range(-30, 30), randf_range(-30, 30))


class Effect extends RefCounted:
	var pos: Vector2
	var kind: String
	var radius: float = 0.0
	var life: float = 0.3
	var age: float = 0.0
	var to: Vector2 = Vector2.ZERO
	var points: Array = []   # brukt av "chain" (kjedepunkter) og "cone" (trekant)


class Floater extends RefCounted:
	var pos: Vector2
	var text: String
	var color: Color
	var life: float = 0.7
	var age: float = 0.0


# =========================================================================
# Tilstand
# =========================================================================
var player: Player
var enemies: Array = []
var projectiles: Array = []
var enemy_shots: Array = []
var pickups: Array = []
var effects: Array = []
var floaters: Array = []

var state: String = "playing"   # playing | levelup | paused | dead | stage_clear | weapon_swap
var pending_perks: Array = []
var pending_swap: Dictionary = {}

var stage_index: int = 0
var loop: int = 0
var time: float = 0.0
var kills: int = 0
var shake: float = 0.0

var _spawn_queue: Array = []
var _boss_spawned: bool = false
var _boss_dead: bool = false
var _boss_dead_time: float = 0.0
var _phantom_timer: float = 3.0
var _grid: Dictionary = {}
var _next_uid: int = 0

const CELL := 32


func _init() -> void:
	player = Player.new(Vector2(Cfg.ARENA_W * 0.5, Cfg.ARENA_H * 0.5))
	_load_stage()


# =========================================================================
# Baner
# =========================================================================
func stage() -> Dictionary:
	return Content.STAGES[stage_index % Content.STAGES.size()]


func hp_mul() -> float:
	return (1.0 + Cfg.STAGE_SCALE_HP * stage_index) * (1.0 + 0.5 * loop)


func dmg_mul() -> float:
	return (1.0 + Cfg.STAGE_SCALE_DMG * stage_index) * (1.0 + 0.3 * loop)


func _load_stage() -> void:
	_boss_spawned = false
	_boss_dead = false
	_boss_dead_time = 0.0
	_spawn_queue = []
	for w in stage()["waves"]:
		_spawn_queue.append({"kind": w[0], "left": w[1], "interval": w[2],
			"timer": w[3]})


func next_stage() -> void:
	stage_index += 1
	if stage_index % Content.STAGES.size() == 0:
		loop += 1
	enemies.clear()
	enemy_shots.clear()
	_load_stage()
	state = "playing"


# =========================================================================
# Hovedløkke
# =========================================================================
func update(delta: float, move: Vector2, dodge: bool, use_active: bool) -> void:
	if state != "playing":
		return
	var dt: float = min(delta, 1.0 / 30.0)
	time += dt

	_rebuild_grid()
	_update_player(dt, move, dodge, use_active)
	_update_spawning(dt)
	_update_enemies(dt)
	_update_weapons(dt)
	_update_projectiles(dt)
	_update_enemy_shots(dt)
	_update_pickups(dt)
	_update_sanity(dt)
	_update_transients(dt)

	if player.hp <= 0.0:
		state = "dead"
	elif _boss_dead and (time - _boss_dead_time > 12.0 or
			(enemies.is_empty() and not _has_item_pickup())):
		for it in pickups:
			if it.kind == "item":
				take_drop(it.payload)
		pickups.clear()
		state = "stage_clear"


func _has_item_pickup() -> bool:
	for p in pickups:
		if p.kind == "item":
			return true
	return false


# =========================================================================
# Romlig rutenett
# =========================================================================
func _rebuild_grid() -> void:
	_grid.clear()
	for e in enemies:
		var key := Vector2i(int(e.pos.x / CELL), int(e.pos.y / CELL))
		if not _grid.has(key):
			_grid[key] = []
		_grid[key].append(e)


func query(center: Vector2, r: float) -> Array:
	var out: Array = []
	var x0 := int((center.x - r) / CELL)
	var x1 := int((center.x + r) / CELL)
	var y0 := int((center.y - r) / CELL)
	var y1 := int((center.y + r) / CELL)
	for gx in range(x0, x1 + 1):
		for gy in range(y0, y1 + 1):
			var key := Vector2i(gx, gy)
			if _grid.has(key):
				out.append_array(_grid[key])
	return out


# =========================================================================
# Spiller
# =========================================================================
func _update_player(dt: float, move: Vector2, dodge: bool, use_active: bool) -> void:
	var p := player
	p.dodge_timer = max(0.0, p.dodge_timer - dt)
	p.iframes = max(0.0, p.iframes - dt)
	p.active_cd = max(0.0, p.active_cd - dt)
	if p.stats.get_stat("hp_regen") > 0.0:
		p.heal(p.stats.get_stat("hp_regen") * dt)

	var m := move
	if m.length() > 1.0:
		m = m.normalized()
	if m.length() > 0.05:
		p.facing = m.normalized()

	if dodge and p.dodge_timer <= 0.0:
		var dist := p.stats.get_stat("dodge_distance")
		if p.blink:
			p.pos += p.facing * dist
			p.pos.x = clamp(p.pos.x, 8.0, Cfg.ARENA_W - 8.0)
			p.pos.y = clamp(p.pos.y, 8.0, Cfg.ARENA_H - 8.0)
			_add_effect(p.pos, "blink", 12.0, 0.25)
		else:
			p.dash_time = 0.14
			p.dash_vel = p.facing * dist / 0.14
		p.iframes = p.stats.get_stat("dodge_iframes")
		p.dodge_timer = max(0.3, p.stats.get_stat("dodge_cooldown"))

	if use_active and p.active_item != "" and p.active_cd <= 0.0:
		_fire_active()

	if p.dash_time > 0.0:
		p.dash_time -= dt
		p.pos += p.dash_vel * dt
	else:
		p.pos += m * p.stats.get_stat("move_speed") * dt

	p.pos.x = clamp(p.pos.x, 6.0, Cfg.ARENA_W - 6.0)
	p.pos.y = clamp(p.pos.y, 6.0, Cfg.ARENA_H - 6.0)


func _fire_active() -> void:
	var p := player
	var d: Dictionary = Content.ITEMS[p.active_item]
	p.active_cd = d["cooldown"]
	match d["effect"]:
		"blast":
			var r: float = 70.0 * p.stats.get_stat("area_mult")
			_add_effect(p.pos, "blast", r, 0.35)
			for e in query(p.pos, r):
				if e.pos.distance_to(p.pos) <= r:
					damage_enemy(e, 60.0, "physical", "", Vector2.ZERO, false)
			shake = max(shake, 6.0)
		"freeze":
			for e in enemies:
				e.freeze = max(e.freeze, 3.0)
			_add_effect(p.pos, "freeze", 200.0, 0.4)
		"heal":
			p.heal(40.0)
			p.sanity = max(0.0, p.sanity - 10.0)
			_add_floater(p.pos + Vector2(0, -8), "+40", Color(0.47, 0.90, 0.55))


# =========================================================================
# Spawning
# =========================================================================
func _update_spawning(dt: float) -> void:
	var done := true
	for w in _spawn_queue:
		if w["left"] <= 0:
			continue
		done = false
		w["timer"] = float(w["timer"]) - dt
		if w["timer"] <= 0.0:
			w["timer"] = w["interval"]
			w["left"] = int(w["left"]) - 1
			spawn(w["kind"], -1.0)
	if done and not _boss_spawned and enemies.is_empty():
		_boss_spawned = true
		spawn(stage()["boss"], 150.0)
		shake = 10.0


func spawn(kind: String, distance: float) -> void:
	var ang := randf() * TAU
	var dist: float = distance if distance > 0.0 else randf_range(160.0, 230.0)
	var pos := player.pos + Vector2(cos(ang), sin(ang)) * dist
	pos.x = clamp(pos.x, 10.0, Cfg.ARENA_W - 10.0)
	pos.y = clamp(pos.y, 10.0, Cfg.ARENA_H - 10.0)
	_next_uid += 1
	enemies.append(Enemy.new(kind, pos, hp_mul(), dmg_mul(), _next_uid))


# =========================================================================
# Fiender
# =========================================================================
func _update_enemies(dt: float) -> void:
	var p := player
	var keep: Array = []
	for e in enemies:
		if not e.alive:
			continue
		e.flash = max(0.0, e.flash - dt)
		e.freeze = max(0.0, e.freeze - dt)
		_tick_statuses(e, dt)
		if not e.alive:
			continue

		var to_player: Vector2 = p.pos - e.pos
		var dist := to_player.length()
		var dir := to_player.normalized() if dist > 0.001 else Vector2.ZERO

		var spd: float = e.speed
		if e.statuses.has("chill"):
			spd *= 1.0 - Cfg.CHILL_SLOW
		if e.freeze > 0.0:
			spd = 0.0

		var ranged: bool = e.data.get("ranged", false)
		if ranged and dist < float(e.data["shot_range"]) * 0.8:
			spd *= 0.25
		e.pos += dir * spd * dt + e.knock * dt
		e.knock *= 0.85

		if ranged:
			e.shot_timer -= dt
			if e.shot_timer <= 0.0 and dist < float(e.data["shot_range"]):
				e.shot_timer = e.data["shot_cd"]
				var shot := Projectile.new()
				shot.pos = e.pos
				shot.vel = dir * float(e.data["shot_speed"])
				shot.radius = 2.5
				shot.damage = e.damage * 0.7
				shot.tag = "physical"
				shot.pierce = 0
				shot.life = 3.0
				shot.sprite = "eshot"
				enemy_shots.append(shot)

		e.contact_timer = max(0.0, e.contact_timer - dt)
		if dist < e.radius + p.radius and e.contact_timer <= 0.0:
			e.contact_timer = Cfg.CONTACT_TICK
			hurt_player(e.damage)
			if p.thorns > 0.0:
				damage_enemy(e, p.thorns, "physical", "", Vector2.ZERO, false)
		keep.append(e)
	enemies = keep


func _tick_statuses(e: Enemy, dt: float) -> void:
	var p := player
	for name in e.statuses.keys():
		if not e.alive:
			return
		if not e.statuses.has(name):
			continue
		e.statuses[name] = float(e.statuses[name]) - dt
		if e.statuses[name] <= 0.0:
			e.statuses.erase(name)
			continue
		if name == "burn":
			damage_enemy(e, Cfg.BURN_DPS * dt * p.stats.tag("fire"), "fire",
				"", Vector2.ZERO, true)
		elif name == "bleed":
			damage_enemy(e, Cfg.BLEED_DPS * dt * p.stats.tag("bleed"), "bleed",
				"", Vector2.ZERO, true)


# =========================================================================
# Våpen
# =========================================================================
func _update_weapons(dt: float) -> void:
	var rate: float = max(0.15, player.stats.get_stat("fire_rate_mult"))
	for w in player.weapons:
		w.timer -= dt * rate
		if w.timer <= 0.0:
			w.timer = w.stat("cooldown")
			_fire(w)


func nearest_enemy(from: Vector2, radius: float) -> Enemy:
	var best: Enemy = null
	var bd := radius * radius
	for e in query(from, radius):
		var d: float = from.distance_squared_to(e.pos)
		if d < bd:
			best = e
			bd = d
	return best


func _fire(w) -> void:
	var p := player
	var d: Dictionary = w.data()
	var beh: String = d["behavior"]
	var rng: float = w.stat("range") * p.stats.get_stat("range_mult")
	var area: float = p.stats.get_stat("area_mult")
	var dmg: float = w.stat("damage")
	var tag: String = d["tag"]
	var applies: String = d.get("applies", "")
	if applies == "":
		if p.universal_corrupt:
			applies = "corrupt"
		elif p.universal_burn:
			applies = "burn"

	if beh == "aura":
		var r := rng * area
		_add_effect(p.pos, "aura", r, 0.18)
		for e in query(p.pos, r):
			if e.pos.distance_to(p.pos) <= r + e.radius:
				damage_enemy(e, dmg, tag, applies, Vector2.ZERO, false)
		return

	if beh == "orbit":
		var count: int = int(w.stat("count"))
		var radius: float = rng * area
		var ospeed: float = w.stat("speed")
		var life: float = w.stat("cooldown") * 1.08
		for i in range(count):
			var pr := Projectile.new()
			pr.pos = p.pos
			pr.vel = Vector2.ZERO
			pr.radius = 2.5 * area
			pr.damage = dmg
			pr.tag = tag
			pr.pierce = 99
			pr.life = life
			pr.sprite = d["sprite"]
			pr.applies = applies
			pr.orbit = true
			pr.orbit_radius = radius
			pr.orbit_angle = w.orbit_phase + TAU * i / max(1, count)
			pr.orbit_speed = ospeed
			projectiles.append(pr)
		w.orbit_phase += 0.7
		return

	if beh == "chain":
		var jumps: int = int(w.stat("count"))
		var hit_list: Array = []
		var points: Array = [p.pos]
		var origin: Vector2 = p.pos
		var cur_range := rng
		var falloff := 1.0
		for i in range(jumps):
			var best: Enemy = null
			var bd := cur_range * cur_range
			for e in query(origin, cur_range):
				if hit_list.has(e):
					continue
				var dd: float = origin.distance_squared_to(e.pos)
				if dd < bd:
					best = e
					bd = dd
			if best == null:
				break
			damage_enemy(best, dmg * falloff, tag, applies, Vector2.ZERO, false)
			hit_list.append(best)
			points.append(best.pos)
			origin = best.pos
			cur_range = rng * (1.5 if best.statuses.has("chill") else 1.0)
			falloff *= 0.85
		if points.size() > 1:
			var cfx := _add_effect(p.pos, "chain", 0.0, 0.18)
			cfx.points = points
		return

	if beh == "cone":
		var dir: Vector2 = p.facing
		var half_angle: float = d["spread"] * 0.5
		for e in query(p.pos, rng):
			var to_e: Vector2 = e.pos - p.pos
			var edist: float = to_e.length()
			if edist > rng + e.radius:
				continue
			if edist > 0.01 and absf(dir.angle_to(to_e.normalized())) > half_angle:
				continue
			damage_enemy(e, dmg, tag, applies, Vector2.ZERO, false)
		var cone_fx := _add_effect(p.pos, "cone", rng, 0.12)
		cone_fx.points = [p.pos, p.pos + dir.rotated(half_angle) * rng,
			p.pos + dir.rotated(-half_angle) * rng]
		return

	var target := nearest_enemy(p.pos, rng)
	if target == null and beh != "spread":
		return
	var aim: Vector2 = (target.pos - p.pos).normalized() if target != null else p.facing

	if beh == "beam":
		var bcount: int = int(w.stat("count"))
		for i in range(bcount):
			var off: float = 0.0 if bcount == 1 else (i - (bcount - 1) / 2.0) * 0.25
			var a := aim.rotated(off)
			var endp := p.pos + a * rng
			var fx := _add_effect(p.pos, "beam", 0.0, 0.15)
			fx.to = endp
			for e in query((p.pos + endp) * 0.5, rng):
				if _dist_to_segment(e.pos, p.pos, endp) < e.radius + 4.0:
					damage_enemy(e, dmg, tag, applies, Vector2.ZERO, false)
		return

	var count: int = int(w.stat("count"))
	var speed: float = w.stat("speed") * p.stats.get_stat("proj_speed_mult")
	var spread: float = d["spread"]
	var pierce: int = int(w.stat("pierce"))
	var life: float = rng / max(20.0, speed) * 1.15
	for i in range(count):
		var off := 0.0
		if count > 1:
			off = (i - (count - 1) / 2.0) * (spread if spread > 0.0 else 0.18)
		off += randf_range(-0.03, 0.03)
		var pr := Projectile.new()
		pr.pos = p.pos
		pr.vel = aim.rotated(off) * speed
		pr.radius = 2.5 * area
		pr.damage = dmg
		pr.tag = tag
		pr.pierce = pierce
		pr.life = life
		pr.sprite = d["sprite"]
		pr.applies = applies
		pr.homing = beh == "homing"
		if pr.homing:
			pr.target = target
		projectiles.append(pr)


static func _dist_to_segment(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var l2 := ab.length_squared()
	if l2 < 0.000001:
		return p.distance_to(a)
	var t: float = clamp((p - a).dot(ab) / l2, 0.0, 1.0)
	return p.distance_to(a + ab * t)


# =========================================================================
# Prosjektiler
# =========================================================================
func _update_projectiles(dt: float) -> void:
	var p := player
	var keep: Array = []
	for pr in projectiles:
		pr.age += dt
		pr.life -= dt
		if pr.life <= 0.0:
			continue
		if pr.orbit:
			pr.orbit_angle += pr.orbit_speed * dt
			pr.pos = p.pos + Vector2(cos(pr.orbit_angle), sin(pr.orbit_angle)) * pr.orbit_radius
		else:
			if pr.homing:
				if pr.target != null and pr.target.alive:
					var want: Vector2 = (pr.target.pos - pr.pos).normalized()
					var sp: float = pr.vel.length()
					pr.vel = (pr.vel.normalized() + want * 9.0 * dt).normalized() * sp
				else:
					pr.target = nearest_enemy(pr.pos, 90.0)
			pr.pos += pr.vel * dt

		var dead := false
		for e in query(pr.pos, pr.radius + 8.0):
			if e.pos.distance_to(pr.pos) > e.radius + pr.radius:
				continue
			if pr.hit_times.has(e.uid) and pr.age - float(pr.hit_times[e.uid]) < 0.45:
				continue
			pr.hit_times[e.uid] = pr.age
			damage_enemy(e, pr.damage, pr.tag, pr.applies, pr.vel, false)
			if pr.pierce <= 0:
				dead = true
				break
			pr.pierce -= 1
		if not dead:
			keep.append(pr)
	projectiles = keep


func _update_enemy_shots(dt: float) -> void:
	var p := player
	var keep: Array = []
	for pr in enemy_shots:
		pr.life -= dt
		pr.pos += pr.vel * dt
		if pr.life <= 0.0:
			continue
		if pr.pos.distance_to(p.pos) < p.radius + pr.radius:
			hurt_player(pr.damage)
			continue
		keep.append(pr)
	enemy_shots = keep


# =========================================================================
# Skade
# =========================================================================
func damage_enemy(e: Enemy, amount: float, tag: String, applies: String,
		knock: Vector2, silent: bool) -> void:
	if not e.alive:
		return
	var p := player
	var dmg := amount * p.stats.get_stat("damage_mult") * p.stats.tag(tag)
	dmg *= 1.0 + p.madness_bonus()
	if p.berserk_bonus > 0.0 and p.hp < p.max_hp() * 0.5:
		dmg *= 1.0 + p.berserk_bonus

	# SYNERGI: ild på nedkjølt fiende gir termisk sjokk
	if tag == "fire" and e.statuses.has("chill"):
		dmg *= Cfg.THERMAL_SHOCK_MULT
		e.statuses.erase("chill")
		_add_effect(e.pos, "shock", 14.0, 0.25)

	# Fordervelse gjør fienden sårbar
	if e.statuses.has("corrupt"):
		dmg *= 1.0 + Cfg.CORRUPT_VULN

	var crit := false
	if not silent and randf() < p.stats.get_stat("crit_chance"):
		crit = true
		dmg *= p.stats.get_stat("crit_mult")
		if e.statuses.has("bleed"):
			e.statuses["bleed"] = float(e.statuses["bleed"]) + Cfg.BLEED_DURATION * 0.5

	e.hp -= dmg
	e.flash = 0.08
	if knock != Vector2.ZERO and not e.is_boss():
		e.knock += knock.normalized() * 40.0

	if applies != "":
		_apply_status(e, applies)

	if not silent and dmg >= 1.0:
		var col := Color(1.0, 0.86, 0.47) if crit else Color(0.92, 0.92, 0.92)
		_add_floater(e.pos + Vector2(0, -e.radius - 2), str(int(dmg)), col, 0.55)

	# Lifesteal
	if p.lifesteal and amount > 0:
		var heal_amt = max(1.0, amount * 0.05)
		p.heal(heal_amt)

	if e.hp <= 0.0:
		_kill(e)


func _apply_status(e: Enemy, name: String) -> void:
	var dur := 2.0
	match name:
		"burn": dur = Cfg.BURN_DURATION + player.burn_bonus
		"chill": dur = Cfg.CHILL_DURATION
		"bleed": dur = Cfg.BLEED_DURATION
		"corrupt": dur = Cfg.CORRUPT_DURATION
	e.statuses[name] = max(float(e.statuses.get(name, 0.0)), dur)


func _kill(e: Enemy) -> void:
	if not e.alive:
		return
	e.alive = false
	kills += 1
	var p := player

	# Ethvert drap gir litt SAN tilbake — jo farligere fienden var, jo mer.
	var restore := Cfg.SANITY_KILL_NORMAL
	if e.is_boss():
		restore = Cfg.SANITY_KILL_BOSS
	elif e.is_elite():
		restore = Cfg.SANITY_KILL_ELITE
	elif e.is_phantom():
		restore = Cfg.SANITY_KILL_PHANTOM
	p.sanity = min(p.max_sanity(), p.sanity + restore)

	# hp_on_kill
	if p.hp_on_kill > 0.0:
		var heal_amt = p.hp_on_kill
		if e.is_phantom():
			heal_amt *= 0.5
		p.heal(heal_amt)

	# SYNERGI: fordervet fiende detonerer ved død, dobbelt hvis den brenner
	if e.statuses.has("corrupt"):
		var r: float = Cfg.CORRUPT_BLAST_RADIUS * p.stats.get_stat("area_mult")
		var blast: float = Cfg.CORRUPT_BLAST_DAMAGE
		if e.statuses.has("burn"):
			blast *= 2.0
			r *= 1.35
		_add_effect(e.pos, "corrupt_blast", r, 0.3)
		for o in query(e.pos, r):
			if o != e and o.pos.distance_to(e.pos) <= r:
				damage_enemy(o, blast, "eldritch", "", Vector2.ZERO, false)

	if p.sanity_on_kill > 0.0 and e.pos.distance_to(p.pos) < 40.0:
		p.sanity = min(p.max_sanity(), p.sanity + p.sanity_on_kill)

	if e.is_phantom():
		_add_effect(e.pos, "poof", 8.0, 0.25)
		return

	var xp: int = e.data["xp"]
	if xp > 0:
		var gem := Pickup.new(e.pos, "xp")
		gem.value = xp
		pickups.append(gem)

	var luck: float = p.stats.get_stat("luck")
	if e.is_boss():
		for i in range(Cfg.BOSS_DROP_COUNT):
			var drop := Pickup.new(e.pos + Vector2(randf_range(-14, 14),
				randf_range(-14, 14)), "item")
			drop.payload = _roll_drop()
			pickups.append(drop)
		shake = 8.0
		_boss_dead = true
		_boss_dead_time = time
		for o in enemies:
			if o.is_phantom() and o.alive:
				o.alive = false
				_add_effect(o.pos, "poof", 8.0, 0.25)
	elif e.is_elite():
		if randf() < Cfg.ELITE_DROP_CHANCE + luck * 0.05:
			var drop2 := Pickup.new(e.pos, "item")
			drop2.payload = _roll_drop()
			pickups.append(drop2)

	if randf() < Cfg.HEAL_DROP_CHANCE * (1.0 + luck * 0.1) * 0.3:
		var h := Pickup.new(e.pos, "heal")
		h.value = 15
		pickups.append(h)


func hurt_player(amount: float) -> void:
	var p := player
	if p.iframes > 0.0 or p.dash_time > 0.0:
		return
	var dmg: float = max(1.0, amount - p.stats.get_stat("armor"))
	p.hp -= dmg
	p.iframes = 0.25
	shake = max(shake, 3.0)
	_add_floater(p.pos + Vector2(0, -8), str(int(dmg)), Color(0.94, 0.35, 0.35))


# =========================================================================
# Drops
# =========================================================================
func _roll_drop() -> Dictionary:
	var p := player
	var roll := randf()
	var owned: Array = []
	for w in p.weapons:
		owned.append(w.wid)
	var new_w: Array = []
	for k in Content.WEAPONS.keys():
		if not owned.has(k):
			new_w.append(k)
	var upgradable: Array = []
	for w in p.weapons:
		if not w.maxed():
			upgradable.append(w)

	# Redusert sjanse for våpen-drops
	if roll < 0.20 and not new_w.is_empty():   # was 0.30
		var wid: String = new_w[randi() % new_w.size()]
		if p.weapons.size() < 5:
			return {"kind": "weapon", "key": wid, "name": Content.WEAPONS[wid]["name"],
				"desc": Content.WEAPONS[wid]["desc"], "sprite": "item_weapon"}
		return {"kind": "weapon_choice", "key": wid, "name": Content.WEAPONS[wid]["name"],
			"desc": Content.WEAPONS[wid]["desc"], "sprite": "item_weapon"}
	if roll < 0.40 and not upgradable.is_empty():  # was 0.55
		var w2 = upgradable[randi() % upgradable.size()]
		return {"kind": "wlevel", "key": w2.wid,
			"name": "%s level %d" % [w2.wname(), w2.level + 1],
			"desc": w2.next_desc(), "sprite": "item_weapon"}

	var pool: Array = []
	for k in Content.ITEMS.keys():
		var it: Dictionary = Content.ITEMS[k]
		if not p.items.has(k) or it["kind"] == "armor":
			pool.append(k)
	if pool.is_empty():
		pool = Content.ITEMS.keys()
	var key: String = pool[randi() % pool.size()]
	var d: Dictionary = Content.ITEMS[key]
	return {"kind": d["kind"], "key": key, "name": d["name"], "desc": d["desc"],
		"sprite": d["sprite"]}


func take_drop(drop: Dictionary) -> void:
	var p := player
	var kind: String = drop["kind"]
	var key: String = drop["key"]
	match kind:
		"weapon":
			var existing = null
			for w in p.weapons:
				if w.wid == key:
					existing = w
					break
			if existing != null:
				if not existing.maxed():
					existing.level += 1
			else:
				p.weapons.append(WeaponInst.new(key))
		"wlevel":
			for w in p.weapons:
				if w.wid == key and not w.maxed():
					w.level += 1
					break
		"active":
			p.active_item = key
			p.active_cd = 0.0
		_:
			p.items.append(key)
			_apply_effects(Content.ITEMS[key])
			p.hp = min(p.hp, p.max_hp())
			p.sanity = min(p.sanity, p.max_sanity())
	_add_floater(p.pos + Vector2(0, -12), drop["name"], Color(0.78, 0.70, 1.0), 1.4)


## Kalt fra UI når spilleren har fått tilbud om å bytte et våpen. index er
## hvilket av de nåværende våpnene som byttes ut, eller -1 for å beholde alt.
func choose_swap(index: int) -> void:
	if state != "weapon_swap":
		return
	var p := player
	if index >= 0 and index < p.weapons.size():
		var new_wid: String = pending_swap["key"]
		p.weapons[index] = WeaponInst.new(new_wid)
		_add_floater(p.pos + Vector2(0, -12), "Swapped to " + str(pending_swap["name"]),
			Color(0.78, 0.70, 1.0), 1.4)
	else:
		_add_floater(p.pos + Vector2(0, -12), "Kept arsenal",
			Color(0.55, 0.53, 0.52), 1.0)
	pending_swap = {}
	state = "playing"


# =========================================================================
# Pickups
# =========================================================================
func _update_pickups(dt: float) -> void:
	var p := player
	var pr: float = p.stats.get_stat("pickup_radius")
	var keep: Array = []
	for it in pickups:
		it.age += dt
		var d: float = it.pos.distance_to(p.pos)
		if _boss_dead and it.kind == "item":
			it.pos += (p.pos - it.pos).normalized() * Cfg.XP_MAGNET_SPEED * dt
		elif d < pr:
			var sp: float = Cfg.XP_MAGNET_SPEED * (1.0 - d / pr * 0.4)
			it.pos += (p.pos - it.pos).normalized() * sp * dt
		else:
			it.pos += it.vel * dt
			it.vel *= 0.9
		if d < p.radius + 4.0:
			_collect(it)
			continue
		keep.append(it)
	pickups = keep


func _collect(it: Pickup) -> void:
	var p := player
	match it.kind:
		"xp":
			p.xp += it.value
			while p.xp >= p.xp_need:
				p.xp -= p.xp_need
				p.level += 1
				p.xp_need = Cfg.xp_to_next(p.level)
				_offer_perks()
		"heal":
			p.heal(it.value)
			_add_floater(p.pos + Vector2(0, -8), "+%d" % it.value,
				Color(0.47, 0.90, 0.55))
		"item":
			if it.payload.get("kind", "") == "weapon_choice":
				pending_swap = it.payload
				state = "weapon_swap"
			else:
				take_drop(it.payload)


# =========================================================================
# Level up
# =========================================================================
func _owned_tags() -> Array:
	var out: Array = []
	for w in player.weapons:
		var t: String = Content.WEAPONS[w.wid]["tag"]
		if not out.has(t):
			out.append(t)
	return out


func _offer_perks() -> void:
	var p := player
	var tags := _owned_tags()
	var pool: Array = []
	for perk in Content.PERKS:
		if perk.get("once", false) and p.taken_perks.has(perk["id"]):
			continue
		if perk.has("needs_tag") and not tags.has(perk["needs_tag"]):
			continue
		pool.append(perk)
	pool.shuffle()
	var picks: Array = pool.slice(0, min(Cfg.PERK_CHOICES, pool.size()))

	if randf() < Cfg.FORBIDDEN_CHANCE:
		var cands: Array = []
		for f in Content.FORBIDDEN:
			if f.get("once", false) and p.taken_perks.has(f["id"]):
				continue
			if p.max_sanity() - float(f["sanity_cost"]) > 10.0:
				cands.append(f)
		if not cands.is_empty():
			picks.append(cands[randi() % cands.size()])

	pending_perks = picks
	state = "levelup"


func choose_perk(index: int) -> void:
	if state != "levelup" or index < 0 or index >= pending_perks.size():
		return
	var p := player
	var perk: Dictionary = pending_perks[index]
	_apply_effects(perk)
	p.taken_perks[perk["id"]] = int(p.taken_perks.get(perk["id"], 0)) + 1
	var cost := float(perk.get("sanity_cost", 0.0))
	if cost > 0.0:
		p.stats.add("max_sanity", -cost)
		p.sanity = min(p.sanity, p.max_sanity())
	p.hp = min(p.hp, p.max_hp())
	pending_perks = []
	state = "playing"


## Én generisk applikator for perks OG items. Nytt innhold trenger ingen kode.
func _apply_effects(d: Dictionary) -> void:
	var p := player
	if d.has("add"):
		for k in d["add"]:
			p.stats.add(k, float(d["add"][k]))
	if d.has("mul"):
		for k in d["mul"]:
			p.stats.scale(k, float(d["mul"][k]))
	if d.has("tag"):
		for k in d["tag"]:
			p.stats.scale_tag(k, float(d["tag"][k]))
	if d.has("heal"):
		p.heal(float(d["heal"]))
	if d.has("restore_sanity"):
		p.sanity = min(p.max_sanity(), p.sanity + float(d["restore_sanity"]))
	if d.has("thorns"):
		p.thorns += float(d["thorns"])
	if d.has("burn_bonus"):
		p.burn_bonus += float(d["burn_bonus"])
	if d.has("sanity_on_kill"):
		p.sanity_on_kill = float(d["sanity_on_kill"])
	if d.has("berserk_bonus"):
		p.berserk_bonus = max(p.berserk_bonus, float(d["berserk_bonus"]))
	if d.has("hp_on_kill"):
		p.hp_on_kill += float(d["hp_on_kill"])
	match d.get("flag", ""):
		"blink":
			p.blink = true
		"madness_double":
			p.madness_scale *= 2.0
		"universal_corrupt":
			p.universal_corrupt = true
		"universal_burn":
			p.universal_burn = true
		"lifesteal":
			p.lifesteal = true


# =========================================================================
# Sanity
# =========================================================================
func _update_sanity(dt: float) -> void:
	var p := player
	var drain := 0.0
	var big: float = Cfg.SANITY_DRAIN_RADIUS * 2.6
	for e in query(p.pos, big):
		if not e.is_eldritch():
			continue
		var radius: float = big if e.is_boss() else Cfg.SANITY_DRAIN_RADIUS
		var d: float = e.pos.distance_to(p.pos)
		if d < radius:
			var rate: float = Cfg.SANITY_DRAIN_RATE * (2.2 if e.is_boss() else 1.0)
			drain += rate * (1.0 - d / radius)
	p.sanity = clamp(p.sanity + (p.stats.get_stat("sanity_regen") - drain) * dt,
		0.0, p.max_sanity())

	# Fantomer: hallusinasjoner som gjør ekte skade, men gir null XP.
	if p.sanity_frac() < Cfg.SANITY_LOW:
		_phantom_timer -= dt
		if _phantom_timer <= 0.0:
			var severity: float = (Cfg.SANITY_LOW - p.sanity_frac()) / Cfg.SANITY_LOW
			_phantom_timer = max(1.2, 6.0 - severity * 4.5)
			spawn("phantom", randf_range(90.0, 150.0))
	else:
		_phantom_timer = 3.0


# =========================================================================
# Kortlivede ting
# =========================================================================
func _add_effect(pos: Vector2, kind: String, radius: float, life: float) -> Effect:
	var fx := Effect.new()
	fx.pos = pos
	fx.kind = kind
	fx.radius = radius
	fx.life = life
	effects.append(fx)
	return fx


func _add_floater(pos: Vector2, text: String, color: Color, life: float = 0.7) -> void:
	var f := Floater.new()
	f.pos = pos
	f.text = text
	f.color = color
	f.life = life
	floaters.append(f)


func _update_transients(dt: float) -> void:
	shake = max(0.0, shake - dt * 20.0)
	var fx_keep: Array = []
	for fx in effects:
		fx.age += dt
		if fx.age < fx.life:
			fx_keep.append(fx)
	effects = fx_keep

	var fl_keep: Array = []
	for f in floaters:
		f.age += dt
		f.pos.y -= 14.0 * dt
		if f.age < f.life:
			fl_keep.append(f)
	floaters = fl_keep
