class_name Sprites
extends RefCounted

## Pixel-sprites bygget i kode fra ASCII-kart. Ingen bildefiler å holde styr
## på — vil du endre en fiende, skriver du om noen bokstaver. Skal du senere
## bytte til ekte PNG-er, er det bare get() som må endres.

const PALETTE := {
	"k": Color8(12, 10, 16),      # kontur
	"d": Color8(38, 34, 48),      # mørk
	"g": Color8(88, 82, 98),      # grå
	"w": Color8(216, 212, 202),   # blek
	"r": Color8(150, 40, 48),     # blod
	"R": Color8(222, 86, 72),     # sterk rød
	"f": Color8(240, 150, 60),    # ild
	"F": Color8(255, 214, 130),   # ild lys
	"y": Color8(238, 208, 110),   # gull
	"b": Color8(62, 104, 168),    # blå
	"c": Color8(126, 206, 224),   # frost
	"p": Color8(110, 66, 150),    # lilla
	"P": Color8(188, 128, 226),   # lilla lys
	"m": Color8(54, 128, 84),     # grønn
	"n": Color8(118, 200, 122),   # grønn lys
	"o": Color8(122, 76, 48),     # brun
	"s": Color8(58, 50, 42),      # mørk brun
	"e": Color8(26, 22, 34),      # tomrom
}

const ART := {
	"player": [
		"...kkk...",
		"..kwwwk..",
		"..kwgwk..",
		"..kwwwk..",
		".kdrrrdk.",
		"kddrrrddk",
		"kdd.r.ddk",
		".k..r..k.",
		"..kd.dk..",
		"..k...k..",
	],
	"grunt": [
		".kkk.",
		"kgRgk",
		"kgggk",
		".kgk.",
		".k.k.",
	],
	"runner": [
		"..kk...",
		".kRRk..",
		"kggggk.",
		".k..kk.",
		".k...k.",
	],
	"brute": [
		"..kkkkk..",
		".koooook.",
		"kosRRsook",
		"koooooook",
		"kosssssok",
		".koooook.",
		".ko...ok.",
		".k.....k.",
	],
	"spitter": [
		"..kkk..",
		".kmmmk.",
		"kmnnnmk",
		"kmmnmmk",
		".kmmmk.",
		"..k.k..",
	],
	"wretch": [
		"..kkkk..",
		".kpPPpk.",
		"kpPeePpk",
		"kppPPppk",
		".kpppk.k",
		"..k..k..",
		".k....k.",
	],
	"phantom": [
		"..cc.c..",
		".cwwwc..",
		"cwe.ewc.",
		"cwwwwwc.",
		".cwwwc..",
		"..c.c...",
	],
	"boss_maw": [
		"....kkkkkk....",
		"..kkrrrrrrkk..",
		".krrRRRRRRrrk.",
		"krrRwwwwwwRrrk",
		"krRwkwkwkwkwRk",
		"krRwwwwwwwwwRk",
		"krrRwkwkwkwRrk",
		".krrRRRRRRrrk.",
		"..kkrrrrrrkk..",
		"....kkkkkk....",
	],
	"boss_crawler": [
		"...kkkkkkk....",
		"..kssoooosk...",
		".ksoRRRRRosk..",
		"ksooRwwwRoosk.",
		"ksoRwkkkwRosk.",
		"ksooRwwwRoosk.",
		".ksoRRRRRosk..",
		"kk.ksooosk.kk.",
		"k...kkkkk...k.",
	],
	"boss_eye": [
		"....kkkkkk....",
		"..kkppPPppkk..",
		".kpPPwwwwPPpk.",
		"kpPwwwwwwwwPpk",
		"kpPwwkkkkwwPpk",
		"kpPwwkeekwwPpk",
		"kpPwwkkkkwwPpk",
		"kpPwwwwwwwwPpk",
		".kpPPwwwwPPpk.",
		"..kkppPPppkk..",
		"....kkkkkk....",
	],
	"bullet": [
		".y.",
		"yFy",
		".y.",
	],
	"ember": [
		".f.",
		"fFf",
		".f.",
	],
	"shard": [
		"kw.",
		".wk",
	],
	"spawn": [
		".P.",
		"PeP",
		".P.",
	],
	"eshot": [
		".m.",
		"mnm",
		".m.",
	],
	"xp": [
		".c.",
		"ccc",
		".c.",
	],
	"xp_big": [
		".cc.",
		"cbbc",
		"cbbc",
		".cc.",
	],
	"heal": [
		".n.",
		"nnn",
		".n.",
	],
	"item_weapon": [
		"..y.",
		".yy.",
		"yy..",
		"y...",
	],
	"item_lens": [
		".ccc.",
		"cwwwc",
		"cwkwc",
		".ccc.",
	],
	"item_heart": [
		".r.r.",
		"rRrRr",
		"rRRRr",
		".rRr.",
		"..r..",
	],
	"item_coal": [
		".ff.",
		"fFFf",
		"fFFf",
		".ff.",
	],
	"item_talisman": [
		".yyy.",
		"ywpwy",
		"ywwwy",
		".yyy.",
	],
	"item_boots": [
		"os...",
		"os...",
		"ossso",
		"ooooo",
	],
	"item_armor": [
		"ggggg",
		"gwwwg",
		"gwwwg",
		".ggg.",
		"..g..",
	],
	"item_blast": [
		".r.r.",
		"rRRRr",
		".RRR.",
		"rRRRr",
		".r.r.",
	],
	"item_freeze": [
		"c.c.c",
		".ccc.",
		"ccccc",
		".ccc.",
		"c.c.c",
	],
	"item_heal": [
		".nnn.",
		"nwwwn",
		"nwnwn",
		".nnn.",
	],
	"item_glass": [
		".r.r.",
		"rRwRr",
		".rwr.",
		"..r..",
	],
	"item_tank": [
		".ggg.",
		"gbbbg",
		"gbwbg",
		".gbg.",
		"..g..",
	],
	"item_zerk": [
		".RRR.",
		"RkwkR",
		"RkskR",
		".RRR.",
	],
	"item_haste": [
		"..y..",
		".yy..",
		"yyyyy",
		"..yy.",
		".y...",
	],
	"item_wildfire": [
		"..f..",
		".fFf.",
		"fFfFf",
		".fFf.",
		"..f..",
	],
}

static var _cache: Dictionary = {}


static func get_tex(sprite_name: String) -> Texture2D:
	if _cache.has(sprite_name):
		return _cache[sprite_name]
	var art: Array = ART.get(sprite_name, ART["grunt"])
	var h: int = art.size()
	var w := 0
	for row in art:
		w = max(w, (row as String).length())
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for y in range(h):
		var row: String = art[y]
		for x in range(row.length()):
			var ch := row[x]
			if PALETTE.has(ch):
				img.set_pixel(x, y, PALETTE[ch])
	var tex := ImageTexture.create_from_image(img)
	_cache[sprite_name] = tex
	return tex


## Hvit blitz når en fiende blir truffet, eller en fargetone for status.
static func get_tinted(sprite_name: String, tint: Color) -> Texture2D:
	var key := "%s#%s" % [sprite_name, tint.to_html(false)]
	if _cache.has(key):
		return _cache[key]
	var art: Array = ART.get(sprite_name, ART["grunt"])
	var h: int = art.size()
	var w := 0
	for row in art:
		w = max(w, (row as String).length())
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for y in range(h):
		var row: String = art[y]
		for x in range(row.length()):
			var ch := row[x]
			if PALETTE.has(ch):
				var base: Color = PALETTE[ch]
				img.set_pixel(x, y, Color(
					max(base.r, tint.r), max(base.g, tint.g),
					max(base.b, tint.b), 1.0))
	var tex := ImageTexture.create_from_image(img)
	_cache[key] = tex
	return tex
