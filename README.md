# SANITY SHOOTER

Top-down bullet-heaven for Android. Joystick til venstre, automatisk ild mot
nærmeste fiende, XP-drops som gir perkvalg, drops fra elitefiender og bosser,
og en sanity-mekanikk som gjør galskap til en ressurs du kan bruke.

Godot 4.3, GDScript, pixelgrafikk generert i kode.

---

## Kjøre spillet

Åpne mappa i Godot 4.3 eller nyere og trykk F5. Ingen avhengigheter å
installere, ingen byggesteg.

Tastatur på PC: piltaster eller WASD for bevegelse, `Mellomrom` for
unnamanøver. Musepekeren fungerer som finger — klikk og dra der joysticken er,
trykk på knappene, trykk på perkkortene.

## Bygge APK

Første gang gjør du det fra editoren, ikke fra CI:

1. **Editor → Håndter eksportmaler** — last ned malene for din Godot-versjon.
2. **Editor → Redigeringsinnstillinger → Eksport → Android** — pek på Android
   SDK og en debug-keystore. Godot lager keystore for deg med knappen der.
3. **Prosjekt → Eksporter → Legg til → Android**, og trykk *Eksporter prosjekt*.

Godot sier tydelig fra hvis noe mangler, i motsetning til buildozer. Når det
virker én gang, ligger oppsettet i `export_presets.cfg`, og da kan vi sette opp
GitHub Actions rundt nøyaktig den fila.

---

## Arkitektur

Delingslinjen er bevisst: **all spillogikk ligger i `world.gd` og kjenner
verken noder, tegning eller input.** `game.gd` leser verdenen og tegner den.

```
scripts/config.gd    Alle tuning-tall. Start her når noe føles feil.
scripts/stats.gd     Statblokk med flate og prosentvise modifikatorer.
scripts/content.gd   Fiender, våpen, perks, items, baner — ren data.
scripts/world.gd     Simuleringen: bevegelse, skade, statuser, drops, baner.
scripts/sprites.gd   Pixel-sprites bygget fra ASCII-kart.
scripts/game.gd      Kamera, tegning, HUD, berøring.
test_sim.gd          Balansetest uten grafikk (se nederst).
```

Kollisjoner går gjennom et romlig rutenett, så antall fiender koster lineært.
Spillet kjører i 480×270 og skaleres til skjermen, som gir ekte pixel-look.

Merk at hele spillet er ett `Node2D` som tegner alt i `_draw()`, ikke tusen
noder. Det er mindre idiomatisk Godot, men holder tegningen forutsigbar og
lar simuleringen være ren data.

---

## Sanity

Sanity er ikke en andre helsebar. Den er en **valuta**.

* Eldritch-fiender tapper SAN når du er nær. Bosser tapper mye, og på lengre
  hold — bosskampen er der psyken faktisk står på spill.
* Jo lavere SAN, jo høyere skade gjør du. Ved 0 SAN er bonusen +60 %.
* Under 50 % SAN dukker **fantomer** opp: de gjør ekte skade, men gir null XP.
  Jo lavere SAN, jo tettere kommer de. Når bossen dør, løser de seg opp.
* Under 25 % vrir skjermen seg og kameraet skjelver.
* Ved level up kan et fjerde, **forbudt** valg dukke opp. Sterkere enn de tre
  andre, men senker maks SAN permanent.

Testkjøringene viser at det virker som tenkt: SAN faller til 0–15 under
bosskampene, og bygg som tar forbudte perks lever varig på kanten.

## Synergier som allerede virker

* **Ild på nedkjølt fiende** → termisk sjokk, 2,2× skade, frosten forsvinner.
  Frostlykt + Røkelseskar er kombinasjonen.
* **Fordervelse** (Tomromslanse) gir +30 % skade tatt, og fienden detonerer
  når den dør.
* **Fordervelse + brann** → detonasjonen dobles og radiusen vokser.
* **Kritisk treff på blødende fiende** → blødningen forlenges.
* **«Alt forderves»** (forbudt perk) gir fordervelse til alle våpen, som gjør
  hele arsenalet til en kjedereaksjon.

Alle ligger i `world.gd`, i `damage_enemy` og `_kill`. Mønsteret er lett å
utvide.

---

## Utvide spillet

Perks og items er **deklarative**. En ny perk er én linje data — ingen kode:

```gdscript
{"id": "grep", "name": "Fast grep", "desc": "+10 % skade og +5 rustning",
    "mul": {"damage_mult": 0.10}, "add": {"armor": 5.0}},
```

`_apply_effects()` i world.gd forstår `add`, `mul`, `tag`, `heal`, `thorns`,
`burn_bonus`, `sanity_on_kill`, `restore_sanity`, `sanity_cost`, `flag` og
`once`. Items bruker nøyaktig samme format.

* **Nytt våpen**: én oppføring i `WEAPONS`, med `behavior` satt til `shot`,
  `spread`, `orbit`, `aura`, `beam` eller `homing`. Nivåene er også data.
* **Ny fiende**: én oppføring i `ENEMIES` pluss et ASCII-kart i `sprites.gd`.
* **Ny bane**: én dict i `STAGES` med bølger og bossnavn.

## Balansetesting uten å spille

```bash
godot --headless --path . --script res://test_sim.gd
```

Kjører tre runder med en bot som holder avstand, velger tilfeldige perks og
spiller til den dør. Skriver ut når hver bane klareres, med nivå, drap og
sanity. Bruk den etter hver balanseendring — den tar under et minutt og fanger
både krasj og runder som låser seg.

## Neste steg jeg ville tatt

1. Lyd. `AudioStreamPlayer` med korte 8-bit-effekter endrer opplevelsen mer
   enn noe annet på lista.
2. Meta-progresjon mellom runder, lagret med `FileAccess` til `user://`.
3. Flere bossmønstre — nå går de mot deg og skyter, ingenting mer.
4. Egne sprites. ASCII-kartene er ment som stillas, ikke som mål.
