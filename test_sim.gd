extends SceneTree

func kite(w: World) -> Vector2:
	var p := w.player
	var f := Vector2.ZERO
	for e in w.enemies:
		var d: float = p.pos.distance_to(e.pos)
		if d < 110.0 and d > 0.01:
			f += (p.pos - e.pos).normalized() * ((110.0 - d) / 110.0)
	f += (Vector2(800, 600) - p.pos).normalized() * 0.35
	return f.normalized()

func _initialize() -> void:
	for trial in range(3):
		seed(trial)
		var w := World.new()
		var i := 0
		while w.state != "dead" and i < 60 * 900:
			i += 1
			w.update(1.0 / 60.0, kite(w), i % 150 == 0, true)
			if w.state == "levelup":
				w.choose_perk(randi() % w.pending_perks.size())
			if w.state == "weapon_swap":
				w.choose_swap(randi() % w.player.weapons.size())
			if w.state == "stage_clear":
				print("  bane %d klar t=%ds nv=%d drap=%d san=%d/%d" % [
					w.stage_index + 1, int(w.time), w.player.level, w.kills,
					int(w.player.sanity), int(w.player.max_sanity())])
				w.next_stage()
		var p := w.player
		var wl := []
		for x in p.weapons:
			wl.append("%s:%d" % [x.wid, x.level])
		print("forsok %d: %s t=%ds niva=%d drap=%d san=%d vapen=%s items=%s aktiv=%s" % [
			trial, w.state, int(w.time), p.level, w.kills, int(p.sanity),
			str(wl), str(p.items), p.active_item])
	quit()
