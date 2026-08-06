extends Node2D

## Alt som har med skjerm og fingre å gjøre. Simuleringen ligger i world.gd
## og vet ingenting om denne fila.

const STICK_BASE := Vector2(58, Cfg.VH - 56)
const STICK_RADIUS := 34.0
const KNOB_RADIUS := 13.0
const DODGE_BTN := Vector2(Cfg.VW - 44, Cfg.VH - 44)
const DODGE_R := 20.0
const ACTIVE_BTN := Vector2(Cfg.VW - 46, Cfg.VH - 92)
const ACTIVE_R := 16.0
const PAUSE_BTN := Vector2(Cfg.VW - 12, 12)

const COL_TEXT := Color(0.89, 0.88, 0.85)
const COL_DIM := Color(0.55, 0.53, 0.52)
const COL_HP := Color(0.78, 0.23, 0.23)
const COL_HP_BG := Color(0.21, 0.09, 0.11)
const COL_SAN := Color(0.55, 0.36, 0.78)
const COL_SAN_BG := Color(0.13, 0.10, 0.20)
const COL_XP := Color(0.43, 0.78, 0.88)

var world: World
var cam := Vector2.ZERO
var font: Font

# Berøringstilstand
var stick_active := false
var stick_index := -1
var stick_base := STICK_BASE
var stick_dir := Vector2.ZERO
var queued_dodge := false
var queued_active := false


func _ready() -> void:
	font = ThemeDB.fallback_font
	world = World.new()
	cam = world.player.pos - Vector2(Cfg.VW, Cfg.VH) * 0.5


func _process(delta: float) -> void:
	var move := stick_dir
	var kb := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if kb.length() > 0.05:
		move += kb
	if move.length() < 0.15:
		move = Vector2.ZERO
	if Input.is_action_just_pressed("ui_accept"):
		queued_dodge = true

	world.update(delta, move, queued_dodge, queued_active)
	queued_dodge = false
	queued_active = false

	_update_camera(delta)
	queue_redraw()


func _update_camera(delta: float) -> void:
	var p := world.player
	var target := p.pos - Vector2(Cfg.VW, Cfg.VH) * 0.5
	cam = cam.lerp(target, min(1.0, delta * 9.0))
	cam.x = clamp(cam.x, 0.0, Cfg.ARENA_W - Cfg.VW)
	cam.y = clamp(cam.y, 0.0, Cfg.ARENA_H - Cfg.VH)
	if world.shake > 0.1:
		cam += Vector2(randf_range(-world.shake, world.shake),
			randf_range(-world.shake, world.shake)) * 0.5
	var frac := p.sanity_frac()
	if frac < Cfg.SANITY_CRITICAL:
		var k: float = (Cfg.SANITY_CRITICAL - frac) / Cfg.SANITY_CRITICAL
		cam += Vector2(sin(world.time * 7.3) * 3.0 * k,
			cos(world.time * 5.1) * 2.0 * k)


# =========================================================================
# Input
# =========================================================================
func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_pointer_down(event.index, event.position)
		else:
			_pointer_up(event.index)
	elif event is InputEventScreenDrag:
		_pointer_move(event.index, event.position)


func _pointer_down(index: int, pos: Vector2) -> void:
	match world.state:
		"levelup":
			var rects := _perk_rects(world.pending_perks.size())
			for i in range(rects.size()):
				if rects[i].has_point(pos):
					world.choose_perk(i)
					return
			return
		"stage_clear":
			world.next_stage()
			return
		"paused":
			world.state = "playing"
			return
		"dead":
			world = World.new()
			stick_active = false
			stick_index = -1
			stick_dir = Vector2.ZERO
			return

	if pos.distance_to(PAUSE_BTN) < 14.0:
		world.state = "paused"
		return
	if pos.distance_to(DODGE_BTN) < DODGE_R + 8.0:
		queued_dodge = true
		return
	if world.player.active_item != "" and pos.distance_to(ACTIVE_BTN) < ACTIVE_R + 8.0:
		queued_active = true
		return
	if not stick_active:
		stick_active = true
		stick_index = index
		stick_base = pos
		stick_dir = Vector2.ZERO


func _pointer_move(index: int, pos: Vector2) -> void:
	if stick_active and stick_index == index:
		var d := pos - stick_base
		if d.length() > STICK_RADIUS:
			d = d.normalized() * STICK_RADIUS
		stick_dir = d / STICK_RADIUS


func _pointer_up(index: int) -> void:
	if stick_index == index:
		stick_active = false
		stick_index = -1
		stick_dir = Vector2.ZERO


# =========================================================================
# Tegning
# =========================================================================
func _draw() -> void:
	_draw_floor()
	_draw_pickups()
	_draw_enemies()
	_draw_player()
	_draw_projectiles()
	_draw_effects()
	_draw_floaters()
	_draw_madness_veil()
	_draw_hud()
	match world.state:
		"levelup": _draw_levelup()
		"stage_clear": _draw_stage_clear()
		"dead": _draw_dead()
		"paused": _draw_paused()


func _blit(sprite_name: String, world_pos: Vector2, tex: Texture2D = null) -> void:
	var t: Texture2D = tex if tex != null else Sprites.get_tex(sprite_name)
	draw_texture(t, world_pos - cam - t.get_size() * 0.5)


func _draw_floor() -> void:
	var tint: Color = world.stage()["tint"]
	draw_rect(Rect2(0, 0, Cfg.VW, Cfg.VH), tint)
	var light := Color(tint.r + 0.03, tint.g + 0.03, tint.b + 0.03)
	var cell := 32
	var ox := int(-cam.x) % cell
	var oy := int(-cam.y) % cell
	var cx := int(cam.x / cell)
	var cy := int(cam.y / cell)
	for gx in range(-1, Cfg.VW / cell + 2):
		for gy in range(-1, Cfg.VH / cell + 2):
			if (gx + cx + gy + cy) % 2 == 0:
				draw_rect(Rect2(gx * cell + ox, gy * cell + oy, cell, cell), light)
	draw_rect(Rect2(-cam.x, -cam.y, Cfg.ARENA_W, Cfg.ARENA_H),
		Color(0.27, 0.25, 0.33), false, 2.0)


func _draw_pickups() -> void:
	for it in world.pickups:
		var sprite_name := "xp"
		if it.kind == "xp":
			sprite_name = "xp_big" if it.value >= 3 else "xp"
		elif it.kind == "heal":
			sprite_name = "heal"
		else:
			sprite_name = it.payload.get("sprite", "item_weapon")
		var bob := sin(it.age * 5.0)
		_blit(sprite_name, it.pos + Vector2(0, bob))


func _draw_enemies() -> void:
	for e in world.enemies:
		var s: Vector2 = e.pos - cam
		if s.x < -30 or s.x > Cfg.VW + 30 or s.y < -30 or s.y > Cfg.VH + 30:
			continue
		var sprite_name: String = e.data["sprite"]
		var tex: Texture2D = null
		if e.flash > 0.0:
			tex = Sprites.get_tinted(sprite_name, Color(1, 1, 1))
		elif e.statuses.has("chill"):
			tex = Sprites.get_tinted(sprite_name, Color(0.35, 0.65, 0.95))
		elif e.statuses.has("burn"):
			tex = Sprites.get_tinted(sprite_name, Color(0.95, 0.55, 0.25))
		elif e.statuses.has("corrupt"):
			tex = Sprites.get_tinted(sprite_name, Color(0.65, 0.35, 0.95))
		else:
			tex = Sprites.get_tex(sprite_name)
		if e.is_phantom():
			draw_texture(tex, e.pos - cam - tex.get_size() * 0.5,
				Color(1, 1, 1, 0.6))
		else:
			draw_texture(tex, e.pos - cam - tex.get_size() * 0.5)
		if e.is_elite() and not e.is_boss():
			var bar := Vector2(s.x - 7, s.y - e.radius - 6)
			draw_rect(Rect2(bar.x, bar.y, 14, 2), Color(0.5, 0.15, 0.15))
			draw_rect(Rect2(bar.x, bar.y, 14.0 * max(0.0, e.hp / e.max_hp), 2),
				Color(0.35, 0.86, 0.43))


func _draw_player() -> void:
	var p := world.player
	var tex: Texture2D = Sprites.get_tex("player")
	if p.iframes > 0.0 and int(p.iframes * 30.0) % 2 == 0:
		tex = Sprites.get_tinted("player", Color(1, 1, 1))
	draw_texture(tex, p.pos - cam - tex.get_size() * 0.5)


func _draw_projectiles() -> void:
	for pr in world.projectiles:
		if pr.sprite == "":
			continue
		_blit(pr.sprite, pr.pos)
	for pr in world.enemy_shots:
		_blit("eshot", pr.pos)


func _draw_effects() -> void:
	for fx in world.effects:
		var t: float = fx.age / fx.life
		var c: Vector2 = fx.pos - cam
		match fx.kind:
			"aura":
				draw_arc(c, fx.radius * (0.9 + 0.1 * t), 0, TAU, 32,
					Color(0.47, 0.78, 0.92), 1.0)
			"blast":
				draw_arc(c, fx.radius * (0.4 + t), 0, TAU, 32,
					Color(0.94, 0.55, 0.35), 2.0)
			"corrupt_blast":
				draw_arc(c, fx.radius * (0.4 + t), 0, TAU, 32,
					Color(0.75, 0.43, 0.94), 2.0)
			"beam":
				var e: Vector2 = fx.to - cam
				draw_line(c, e, Color(0.67, 0.43, 0.90), max(1.0, 4.0 * (1.0 - t)))
				draw_line(c, e, Color(0.94, 0.86, 1.0), 1.0)
			"shock":
				draw_arc(c, fx.radius * (0.3 + t), 0, TAU, 20,
					Color(1.0, 0.90, 0.63), 1.0)
			"blink":
				draw_arc(c, fx.radius * (1.0 - t), 0, TAU, 20,
					Color(0.55, 0.86, 0.94), 1.0)
			"freeze":
				draw_arc(c, fx.radius * t, 0, TAU, 32,
					Color(0.67, 0.90, 1.0), 1.0)
			"poof":
				draw_arc(c, 6.0 * (1.0 - t), 0, TAU, 16,
					Color(0.78, 0.86, 0.94), 1.0)


func _draw_floaters() -> void:
	for f in world.floaters:
		var col: Color = f.color
		col.a = 1.0 - f.age / f.life
		_text_center(f.pos - cam, f.text, 8, col)


func _draw_madness_veil() -> void:
	var frac := world.player.sanity_frac()
	if frac < Cfg.SANITY_CRITICAL:
		var k: float = (Cfg.SANITY_CRITICAL - frac) / Cfg.SANITY_CRITICAL
		draw_rect(Rect2(0, 0, Cfg.VW, Cfg.VH), Color(0.35, 0.12, 0.51, 0.27 * k))


# =========================================================================
# Tekst-hjelpere
# =========================================================================
func _text(pos: Vector2, s: String, size: int, col: Color) -> void:
	draw_string(font, pos, s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)


func _text_center(center: Vector2, s: String, size: int, col: Color) -> void:
	var w := font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	draw_string(font, center - Vector2(w * 0.5, 0), s,
		HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)


func _bar(x: float, y: float, w: float, h: float, frac: float,
		col: Color, bg: Color) -> void:
	draw_rect(Rect2(x, y, w, h), bg)
	var f: float = clamp(frac, 0.0, 1.0)
	if f > 0.0:
		draw_rect(Rect2(x, y, max(1.0, w * f), h), col)
	draw_rect(Rect2(x, y, w, h), Color(0.03, 0.02, 0.05), false, 1.0)


func _cooldown_arc(center: Vector2, radius: float, frac: float, col: Color) -> void:
	if frac <= 0.0:
		return
	draw_arc(center, radius, -PI / 2.0, -PI / 2.0 + TAU * frac, 24, col, 2.0)


# =========================================================================
# HUD
# =========================================================================
func _draw_hud() -> void:
	var p := world.player

	_bar(0, 0, Cfg.VW, 4, float(p.xp) / max(1.0, float(p.xp_need)),
		COL_XP, Color(0.08, 0.12, 0.15))
	_bar(6, 8, 92, 7, p.hp / p.max_hp(), COL_HP, COL_HP_BG)
	_text(Vector2(102, 15), "%d/%d" % [int(p.hp), int(p.max_hp())], 8, COL_DIM)

	_bar(6, 18, 92, 5, p.sanity_frac(), COL_SAN, COL_SAN_BG)
	var san := "SAN %d" % int(p.sanity)
	if p.madness_bonus() > 0.02:
		san += "   +%d%% skade" % int(p.madness_bonus() * 100.0)
	var san_col := COL_DIM
	if p.sanity_frac() < Cfg.SANITY_LOW:
		san_col = Color(0.78, 0.59, 0.94)
	_text(Vector2(102, 24), san, 8, san_col)

	_text(Vector2(6, 34), world.stage()["name"], 8, COL_DIM)
	_text(Vector2(6, 44), "Nv %d   Drap %d" % [p.level, world.kills], 8, COL_DIM)

	var y := 56.0
	for w in p.weapons:
		_text(Vector2(6, y), "%s %d" % [w.wname(), w.level], 8,
			Color(0.67, 0.66, 0.63))
		y += 9.0

	for e in world.enemies:
		if e.is_boss():
			_bar(90, Cfg.VH - 14, Cfg.VW - 180, 6, e.hp / e.max_hp,
				Color(0.75, 0.20, 0.27), Color(0.16, 0.06, 0.09))
			_text_center(Vector2(Cfg.VW * 0.5, Cfg.VH - 18), e.data["name"], 9,
				Color(0.90, 0.59, 0.63))
			break

	_draw_controls()


func _draw_controls() -> void:
	var p := world.player
	var base := stick_base if stick_active else STICK_BASE
	draw_arc(base, STICK_RADIUS, 0, TAU, 32, Color(0.16, 0.15, 0.20), 1.0)
	var knob := base + stick_dir * STICK_RADIUS * 0.7
	draw_circle(knob, KNOB_RADIUS, Color(0.34, 0.32, 0.41))
	draw_arc(knob, KNOB_RADIUS, 0, TAU, 20, Color(0.08, 0.07, 0.11), 1.0)

	var ready := p.dodge_timer <= 0.0
	var dcol := Color(0.47, 0.78, 0.88) if ready else Color(0.21, 0.24, 0.27)
	draw_circle(DODGE_BTN, DODGE_R, Color(0.09, 0.09, 0.13))
	draw_arc(DODGE_BTN, DODGE_R, 0, TAU, 32, dcol, 2.0)
	_text_center(DODGE_BTN + Vector2(0, 3), "BLINK" if p.blink else "UNNA", 8, dcol)
	if not ready:
		_cooldown_arc(DODGE_BTN, DODGE_R - 4.0,
			1.0 - p.dodge_timer / max(0.01, p.stats.get_stat("dodge_cooldown")),
			Color(0.35, 0.55, 0.67))

	if p.active_item != "":
		var d: Dictionary = Content.ITEMS[p.active_item]
		var ok := p.active_cd <= 0.0
		var acol := Color(0.90, 0.75, 0.43) if ok else Color(0.24, 0.22, 0.19)
		draw_circle(ACTIVE_BTN, ACTIVE_R, Color(0.09, 0.09, 0.13))
		draw_arc(ACTIVE_BTN, ACTIVE_R, 0, TAU, 28, acol, 2.0)
		_text_center(ACTIVE_BTN + Vector2(0, 3),
			(d["name"] as String).substr(0, 6), 8, acol)
		if not ok:
			_cooldown_arc(ACTIVE_BTN, ACTIVE_R - 4.0,
				1.0 - p.active_cd / float(d["cooldown"]), Color(0.59, 0.47, 0.27))

	draw_rect(Rect2(PAUSE_BTN.x - 3, PAUSE_BTN.y - 4, 2, 9), COL_DIM)
	draw_rect(Rect2(PAUSE_BTN.x + 1, PAUSE_BTN.y - 4, 2, 9), COL_DIM)


# =========================================================================
# Overlegg
# =========================================================================
func _perk_rects(count: int) -> Array:
	var h := 34.0
	var gap := 6.0
	var total: float = count * h + max(0, count - 1) * gap
	var top: float = (Cfg.VH - total) * 0.5 + 12.0
	var out: Array = []
	for i in range(count):
		out.append(Rect2(46, top + i * (h + gap), Cfg.VW - 92, h))
	return out


func _veil(alpha: float) -> void:
	draw_rect(Rect2(0, 0, Cfg.VW, Cfg.VH), Color(0.02, 0.02, 0.04, alpha))


func _draw_levelup() -> void:
	_veil(0.75)
	_text_center(Vector2(Cfg.VW * 0.5, 30), "NIVÅ %d" % world.player.level, 16,
		Color(0.92, 0.91, 0.86))
	var rects := _perk_rects(world.pending_perks.size())
	for i in range(world.pending_perks.size()):
		var perk: Dictionary = world.pending_perks[i]
		var r: Rect2 = rects[i]
		var forb: bool = perk.get("forbidden", false)
		draw_rect(r, Color(0.08, 0.06, 0.11) if forb else Color(0.06, 0.08, 0.10))
		draw_rect(r, Color(0.77, 0.36, 0.86) if forb else Color(0.43, 0.78, 0.88),
			false, 1.0)
		_text(Vector2(r.position.x + 8, r.position.y + 15), perk["name"], 11,
			Color(0.91, 0.71, 0.98) if forb else COL_TEXT)
		_text(Vector2(r.position.x + 8, r.position.y + 27), perk["desc"], 8, COL_DIM)
		if forb:
			_text(Vector2(r.end.x - 44, r.position.y + 13), "FORBUDT", 8,
				Color(0.82, 0.43, 0.90))


func _draw_stage_clear() -> void:
	_veil(0.80)
	_text_center(Vector2(Cfg.VW * 0.5, 96), "BANEN ER STILLE", 16,
		Color(0.92, 0.91, 0.86))
	_text_center(Vector2(Cfg.VW * 0.5, 122),
		"Drap: %d   Nivå: %d" % [world.kills, world.player.level], 10, COL_DIM)
	_text_center(Vector2(Cfg.VW * 0.5, 152), "Trykk for å gå videre", 10,
		Color(0.59, 0.82, 0.90))


func _draw_dead() -> void:
	_veil(0.85)
	_text_center(Vector2(Cfg.VW * 0.5, 92), "DU ER BORTE", 16,
		Color(0.86, 0.35, 0.35))
	_text_center(Vector2(Cfg.VW * 0.5, 120),
		"Overlevde %d s  ·  %d drap  ·  nivå %d" % [int(world.time), world.kills,
			world.player.level], 9, COL_DIM)
	_text_center(Vector2(Cfg.VW * 0.5, 150), "Trykk for å begynne på nytt", 10,
		COL_TEXT)


func _draw_paused() -> void:
	_veil(0.70)
	var p := world.player
	_text_center(Vector2(Cfg.VW * 0.5, 100), "PAUSE", 16, COL_TEXT)
	var lines := [
		"Skade x%.2f   Skytefart x%.2f" % [p.stats.get_stat("damage_mult"),
			p.stats.get_stat("fire_rate_mult")],
		"Rekkevidde x%.2f   Luck %d" % [p.stats.get_stat("range_mult"),
			int(p.stats.get_stat("luck"))],
		"Rustning %d   Krit %d%%" % [int(p.stats.get_stat("armor")),
			int(p.stats.get_stat("crit_chance") * 100.0)],
	]
	for i in range(lines.size()):
		_text_center(Vector2(Cfg.VW * 0.5, 128 + i * 12), lines[i], 8, COL_DIM)
	var names: Array = []
	for k in p.items:
		names.append(Content.ITEMS[k]["name"])
	var items_txt: String = ", ".join(names) if not names.is_empty() else "ingen"
	_text_center(Vector2(Cfg.VW * 0.5, 176), "Gjenstander: " + items_txt, 8, COL_DIM)
	_text_center(Vector2(Cfg.VW * 0.5, 198), "Trykk for å fortsette", 10,
		Color(0.59, 0.82, 0.90))
