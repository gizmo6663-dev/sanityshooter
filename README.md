# MOB BLASTER

Fargerikt 3D-mobspill i stil med reklamene: skyt en strøm av blå mober
oppover banen, send dem gjennom ×2-, ×3- og ×4-porter så de formerer seg, og
knus den røde fiendebasen før de røde mobene når borgen din. Mellom rundene
bruker du myntene på oppgraderinger.

Spillet er laget med Three.js (WebGL) og pakket som en Android-app.
GitHub Actions bygger APK-en automatisk.

---

## Last ned og installer på telefonen

1. Gå til **Releases** på GitHub-siden til repoet (høyre side, eller
   `…/sanityshooter/releases`).
2. Åpne den nyeste «Mob Blaster 1.0.N» og trykk på `MobBlaster-1.0.N.apk`.
3. Åpne fila på telefonen. Første gang må du tillate «Installer ukjente apper»
   for nettleseren eller filbehandleren.

Alle bygg signeres med den samme nøkkelen, så en ny APK installeres som en
oppdatering over den gamle, og fremgangen din blir liggende.

Hver push bygger en ny APK (fanen **Actions** → «Bygg APK»). Bygg fra andre
greiner enn hovedgreinen havner som *pre-release*.

## Slik spiller du

- **Hold fingeren nede** for å skyte, **dra sidelengs** for å flytte kanonen.
- Mober som går gjennom en **×N-port** blir N ganger så mange. Grønne
  **+N-porter** gir en engangsbonus og forsvinner.
- Hver salve lader **kjempen**. Når knappen lyser gult, trykk for å sende en
  gullkjempe med mye liv. Den lager nye mober når den går gjennom porter.
- Røde mober som når muren din, tar liv fra borgen. Fra nivå 3 kommer det
  også store røde **brutere**.
- Du får mynter for hver fiende du dreper og en bonus når du vinner. Taper du,
  får du likevel en del av belønningen etter hvor mye du skadet basen.

### Oppgraderinger

| Oppgradering | Effekt |
|---|---|
| Skuddtakt | Flere salver i sekundet |
| Mobstyrke | +1 liv per mob (porter kopierer livet) |
| Ekstra løp | +1 mob per salve (maks 4) |
| Kjempekraft | Mer liv til kjempen |
| Kjempelading | Færre salver for å lade kjempen |
| Borgmur | Flere liv til borgen |
| Gullinntekt | +20 % mynter |
| Portmagi | +1 på alle ×-porter |

---

## Kjøre i nettleseren

Spillet er rene filer i `web/`, uten byggesteg:

```sh
cd web
python3 -m http.server 8000
# åpne http://localhost:8000
```

Mus fungerer som finger. Piltaster/A–D flytter, mellomrom skyter, G sender
kjempen.

## Arkitektur

```
web/js/config.js     Alle tuning-tall. Start her når noe føles feil.
web/js/progress.js   Nivå, mynter, oppgraderinger og lagring (localStorage).
web/js/sim.js        Simuleringen av én runde. Kjenner verken DOM eller three.js.
web/js/render.js     Three.js-scenen: bane, porter, baser, mober, partikler.
web/js/main.js       Skjermer, input og hovedløkka.
web/js/audio.js      Syntetiske lydeffekter.
web/vendor/          three.js r169 (MIT).
app/                 Android-skallet: én WebView som laster web/ fra APK-en.
tools/balance.mjs    Balansetest uten grafikk.
```

Mobene tegnes med `InstancedMesh`, så hundrevis av enheter blir noen få
draw calls. Porter med samme farge betyr samme multiplikator.

## Balansetest

```sh
node tools/balance.mjs 30
```

En bot spiller nivå etter nivå, kjøper den billigste oppgraderingen mellom
rundene og prøver igjen når den taper. Utskriften viser hvor mange forsøk og
hvor lang tid hvert nivå tok. Juster `web/js/config.js` og kjør på nytt.

## Bygge APK lokalt

Krever JDK 17 og Android SDK (`ANDROID_HOME`):

```sh
./gradlew assembleRelease
# app/build/outputs/apk/release/app-release.apk
```

Nøkkelen i `app/mobblaster.keystore` er bare for hobbybruk, så alle bygg
kan oppdatere hverandre. Bytt den ut med en hemmelig nøkkel før en eventuell
Play Store-publisering.
