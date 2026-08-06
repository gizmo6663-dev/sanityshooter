# VANVIDD

Top-down bullet-heaven for Android. Joystick til venstre, automatisk ild mot
nærmeste fiende, XP-drops som gir perkvalg, drops fra elitefiender og bosser,
og en sanity-mekanikk som gjør galskap til en ressurs du kan bruke.

Skrevet i Python med pygame-ce. Pakkes til APK med Buildozer.

---

## Kjøre på PC

```bash
pip install pygame-ce
python main.py
```

Tastatur: WASD eller piltaster for bevegelse, `Mellomrom` for unnamanøver,
`E` for aktivt item, `Esc` for pause, `1`–`4` for perkvalg, `Enter` for å gå
videre etter en bane, `R` for å starte på nytt.

## Bygge APK

`.github/workflows/build.yml` bygger en debug-APK ved hver push til `main` og
laster den opp som artifact. Lokalt:

```bash
pip install buildozer cython
buildozer android debug
```

Merk: p4a-oppskriften `pygame` krever en nyere python-for-android enn den du
brukte til Kivy-prosjektene. Låser du versjoner i `buildozer.spec`, bruk en
p4a-branch fra 2024 eller senere.

---

## Arkitektur

Delingslinjen er bevisst: **all spillogikk ligger i `vanvidd/core/` og
importerer aldri pygame.** Vil du senere bytte til Godot eller en annen
motor, er det bare `render/` og `main.py` som må skrives om.

```
vanvidd/core/config.py     Alle tuning-tall. Start her når noe føles feil.
vanvidd/core/stats.py      Statblokk med flate og prosentvise modifikatorer.
vanvidd/core/content.py    Fiender, våpen, perks, items, baner — ren data.
vanvidd/core/world.py      Simuleringen: bevegelse, skade, statuser, drops.
vanvidd/render/sprites.py  Pixel-sprites bygget fra ASCII-kart i kode.
vanvidd/render/view.py     Kamera og verdenstegning.
vanvidd/render/hud.py      Joystick, knapper, barer, overlegg.
main.py                    Løkke, multitouch, tilstandsbytter.
```

Kollisjoner går gjennom et romlig rutenett (`Grid`), så antall fiender koster
lineært, ikke kvadratisk. Spillet simuleres i 480×270 og skaleres opp til
skjermen — det gir ekte pixel-look og lite fyllrate å betale for.

---

## Sanity

Sanity er ikke en andre helsebar. Den er en **valuta**.

* Eldritch-fiender tapper SAN når du er nær dem. Bosser tapper mye, og på
  lengre hold — bosskampen er der psyken faktisk står på spill.
* Jo lavere SAN, jo høyere skade gjør du. Ved 0 SAN er bonusen +60 %.
* Under 50 % SAN begynner **fantomer** å dukke opp: de gjør ekte skade, men
  gir null XP. Jo lavere SAN, jo tettere kommer de.
* Under 25 % vrir skjermen seg og kameraet begynner å skjelve.
* Ved level up kan et fjerde, **forbudt** valg dukke opp. Det er sterkere enn
  de tre andre, men senker maks SAN permanent.

Det gir en frivillig spiral: du kan bygge en karakter som med vilje lever på
kanten av sammenbrudd fordi det er der skaden ligger. `f_madness`
(«Klarsyn i mørket») dobler hele den bonusen, og `i_talisman` og
`sanity_regen`-perken finnes for spillere som heller vil klore seg fast.

## Synergier som allerede virker

* **Ild på nedkjølt fiende** → termisk sjokk, 2,2× skade og frosten forsvinner.
  Frostlykt + Røkelseskar er kombinasjonen.
* **Fordervelse** (Tomromslanse) gir +30 % skade tatt, og fienden detonerer
  når den dør.
* **Fordervelse + brann** → detonasjonen dobles og radiusen vokser.
* **Kritisk treff på blødende fiende** → blødningen forlenges.
* **«Alt forderves»** (forbudt perk) gir fordervelse til alle våpen, som
  gjør hele arsenalet til en kjedereaksjon.

Alle er implementert i `world.damage_enemy` og `world._kill` — mønsteret er
lett å utvide.

---

## Utvide spillet

* **Nytt våpen**: én oppføring i `WEAPONS` i `content.py`. Oppførselen velges
  med `behavior`: `shot`, `spread`, `orbit`, `aura`, `beam`, `homing`.
* **Ny perk**: én `Perk(...)` i `PERKS`. `apply` er en funksjon som får
  verdenen. Forbudte perks legges i `FORBIDDEN` med `sanity_cost`.
* **Ny fiende**: én oppføring i `ENEMIES` pluss et ASCII-kart i `sprites.ART`.
* **Ny bane**: én dict i `STAGES` med bølger og bossnavn.

## Neste steg jeg ville tatt

1. Lyd — pygame.mixer, korte 8-bit-effekter. Endrer opplevelsen mer enn noe
   annet på listen.
2. Meta-progresjon mellom runder (permanente oppgraderinger kjøpt for drap).
3. Flere bossmønstre — nå går de bare mot deg og skyter.
4. Lagring av høyeste bane og opplåste våpen (JSON i appmappa).
5. Skadetallene bør kunne skrus av i en innstillingsmeny; de koster fyllrate.
