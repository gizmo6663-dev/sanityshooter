# DYPET

Mørk roguelite dungeon crawler for Android, inspirert av *The Binding of Isaac*
og *Vampire Survivors*. Du er en hettekledd vandrer med en lykt, på vei ned
gjennom fire etasjer med kjellere, katakomber og benhus. Du skyter automatisk.
Du styrer, dasher unna skudd, samler gjenstander som virker sammen, og
prøver å nå bunnen.

Pikselgrafikk tegnet med Canvas 2D, pakket som en Android-app. GitHub Actions
bygger APK-en automatisk.

---

## Last ned og installer på telefonen

1. Gå til **Releases** på GitHub-siden til repoet.
2. Åpne den nyeste «Dypet 1.0.N» og trykk på `Dypet-1.0.N.apk`.
3. Åpne fila på telefonen. Første gang må du tillate «Installer ukjente apper».

Alle bygg signeres med samme nøkkel, så en ny APK installeres som en
oppdatering over den gamle.

## Slik spiller du

- **Venstre tommel** (hvor som helst på skjermen) styrer. Du **skyter
  automatisk** på nærmeste fiende.
- **DASH**-knappen gir et kort byks der du ikke kan bli truffet.
- **Liv** er hjerter, og hvert treff tar et halvt hjerte.
- Hver etasje er et kart med rom. **Dørene låses** til rommet er tomt for
  fiender. Kartet øverst til høyre viser rommene du har sett.
  - ♛ **Skattkammer**: en gratis gjenstand.
  - ¢ **Butikk**: gjenstander og hjerter for mynter.
  - ☠ **Boss**: slå den, så åpner det seg en luke ned til neste etasje.
- Drepte fiender slipper **XP**. Nytt nivå gir et valg mellom tre
  velsignelser, som i Vampire Survivors.
- Slå bossen i fjerde etasje for å vinne. En run tar rundt 15–20 minutter.

### Gjenstander og synergier

Det finnes 22 gjenstander. De virker sammen gjennom noen felles regler:

- Skudd kan ha **elementer**: ild (brenner), is (bremser og fryser fast),
  gift (skader over tid, giftsky når fienden dør).
- **Alt et skudd lager, arver elementene**: Svartkrutt-eksplosjoner,
  Splintret hodeskalle-splinter og Irrbloss-treff brenner, fryser eller
  forgifter like mye som selve skuddet.
- **Skuddmodifikatorer** stables: flere skudd, søkende, gjennomborende,
  splittende, eksploderende og større skudd.
- **Tre gjenstander av samme type** gir en **forvandling**: Askebærer (ild),
  Vinterhjerte (is), Pestbærer (gift), Okkultist, Stormskudd og Kjøttberg.

### Fiender

Fluer som svermer, larver som kryper rundt steinene, øyne som holder avstand
og skyter, beinværer som stanger når du står på linje med dem, og slim som
deler seg. Bossen **Den oppsvulmede** skyter ringer av blod, hopper mot deg og
kaller inn fluer, og blir sintere når den har halvt liv igjen.

---

## Kjøre i nettleseren

Spillet er rene filer i `web/`, uten byggesteg:

```sh
cd web
python3 -m http.server 8000
# åpne http://localhost:8000
```

Tastatur: WASD eller piltaster styrer, mellomrom dasher og Esc pauser.

## Arkitektur

```
web/js/config.js     Alle tuning-tall. Start her når noe føles feil.
web/js/dungeon.js    Generering av etasjer: romkart, steinmønstre, fiender.
web/js/enemies.js    Fiendetyper og oppførsel, inkludert bossen.
web/js/items.js      Gjenstander, velsignelser (level-up) og forvandlinger.
web/js/world.js      Simuleringen: bevegelse, kollisjon, skudd, statuser, rom.
web/js/render2d.js   Pikselrendereren: rom, figurer, effekter, HUD og minikart.
web/js/sprites.js    Alle figurer og ting, tegnet i kode (Canvas 2D).
web/js/roomart.js    Tegner rom: steinvegger, døråpninger, gulvheller, mose.
web/js/pixel.js      Gjør tegningene om til piksler: palett, dithering, omriss, lys.
web/js/font.js       Liten 3x5 pikselfont for HUD-en.
web/js/main.js       Skjermer, joystick og hovedløkka.
web/js/audio.js      Syntetiske lydeffekter.
app/                 Android-skallet: én WebView som laster web/ fra APK-en.
tools/balance.mjs    Balansetest uten grafikk.
```

Spillogikken (`world.js`) kjenner verken DOM eller tegning, så den kan
kjøres i Node.

Grafikken tegnes i lav oppløsning (rundt 200 piksler bredt) og forstørres med
et helt tall, så pikslene holder seg skarpe. Hvert rom males én gang og
lagres; figurene gjengis én gang per animasjonsbilde og lagres.
`style-mock.html` og `pixel-mock.html` viser stilskissene.

## Balansetest

```sh
node tools/balance.mjs 12
```

En bot spiller hele runs. Den kjemper (holder avstand og unngår skudd),
plukker opp ting, utforsker rom for rom, slår bossen og tar luka ned.
Utskriften viser hvor langt hver run kom, hvor lang tid hver etasje tok og
hvilke gjenstander boten hadde.

## Bygge APK lokalt

Krever JDK 17 og Android SDK (`ANDROID_HOME`):

```sh
./gradlew assembleRelease
# app/build/outputs/apk/release/app-release.apk
```

Nøkkelen i `app/mobblaster.keystore` er bare for hobbybruk, så alle bygg kan
oppdatere hverandre. Bytt den ut med en hemmelig nøkkel før en eventuell
Play Store-publisering.
