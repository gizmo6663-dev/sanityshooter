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
  **+N-porter** gir en engangsbonus. Røde **÷2-feller** dreper halvparten av
  mobene som går gjennom, så sikt rundt dem.
- Hver salve lader **kjempen**. Når knappen lyser gult, trykk for å sende den.
- Fiendebasen skyter **katapultsteiner** mot kanonen. Den røde ringen viser
  hvor steinen lander: flytt deg!
- Fiender: vanlige, raske **løpere**, **skjoldbærere** med rustning, **bombere**
  som tar med seg mobene dine når de dør, store **brutere**, og en **boss**
  hvert 5. nivå.
- Drar en runde ut, blir fiendene rasende og kommer stadig tettere.

### Runs, gjenstander og synergier

Spillet er en roguelite, litt som *The Binding of Isaac*:

1. En **run** starter på nivå 1 uten gjenstander. Skaden på borgen følger med
   fra nivå til nivå.
2. Etter hver seier **velger du 1 av 3 gjenstander**, og etter en boss er
   valgene sjeldnere og sterkere.
3. I **butikken** bruker du myntene på flere gjenstander, nye varer eller
   reparasjon av borgen.
4. Faller borgen, er runen over. Du får **edelsteiner** etter hvor langt du kom,
   og de brukes i **verkstedet** på permanente oppgraderinger.

Det finnes 33 gjenstander. De påvirker hverandre gjennom noen felles regler:

- Mober kan ha et **element**: ild (brenner), is (fryser), gift (giftsky når
  de dør). **Porter kopierer alt** ved moben, så en ildmob gjennom ×3 blir tre
  ildmober.
- **Eksplosjoner, kjempetramp og tårnskudd får elementet** til kilden. Kamikaze
  pluss ild gir brennende eksplosjoner, Tordenkjempe pluss is gir et
  frysende tramp, og så videre.
- Dødsfall utløser nye effekter (deling, eksplosjoner, giftskyer, pest) som
  kan drepe flere og utløse nye kjedereaksjoner.
- **Tre gjenstander med samme type** gir en **forvandling**: Pyroman (ild),
  Permafrost (is), Pestlege (gift), Titan (kjempe), Portherre (port),
  Legion (sverm), Festning (mur) og Kong Midas (gull).

### Verkstedet

| Oppgradering | Effekt |
|---|---|
| Skuddtakt | Flere salver i sekundet |
| Mobstyrke | +1 liv per mob |
| Ekstra løp | +1 mob per salve |
| Kjempekraft / Kjempelading | Sterkere kjemper, raskere lading |
| Borgmur | Flere liv til borgen |
| Gullinntekt | Flere mynter |
| Portmagi | +1 på alle ×-porter |
| Flere valg | 4 gjenstander å velge mellom |
| Startgave | Start hver run med en gjenstand |

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
web/js/progress.js   Edelsteiner, verkstedet og lagring av runen (localStorage).
web/js/items.js      Alle gjenstander, typer og forvandlinger.
web/js/run.js        Mellom nivåene: gjenstandsvalg, butikk, renter.
web/js/sim.js        Simuleringen av én runde: elementer, statuser, kjedereaksjoner.
web/js/render.js     Three.js-scenen: tegner verdenen hvert bilde, animerer mobene.
web/js/models.js     Alle 3D-modeller og teksturer, bygget i kode (ingen asset-filer).
web/js/main.js       Skjermer, input og hovedløkka.
web/js/audio.js      Syntetiske lydeffekter.
web/vendor/          three.js r169 (MIT).
app/                 Android-skallet: én WebView som laster web/ fra APK-en.
tools/balance.mjs    Balansetest uten grafikk.
```

Mobene er små figurer med armer, bein, øyne og hatt/hjelm som animeres
hvert bilde. De tegnes med `InstancedMesh`, så hundrevis av enheter blir noen
få draw calls, og statiske rekvisitter slås sammen til noen få store mesher.
Oppløsningen senkes automatisk hvis telefonen ikke klarer 40 bilder i sekundet. Porter med samme farge betyr samme multiplikator.

## Balansetest

```sh
node tools/balance.mjs 12
```

En bot spiller run etter run. Den sikter mot beste port, unngår
katapultsteiner, velger en tilfeldig gjenstand etter hver seier, handler i
butikken og bruker edelsteinene i verkstedet når runen er over. Utskriften
viser hvor langt hver run kom og hvor lange rundene var. Juster
`web/js/config.js` og kjør på nytt.

## Bygge APK lokalt

Krever JDK 17 og Android SDK (`ANDROID_HOME`):

```sh
./gradlew assembleRelease
# app/build/outputs/apk/release/app-release.apk
```

Nøkkelen i `app/mobblaster.keystore` er bare for hobbybruk, så alle bygg
kan oppdatere hverandre. Bytt den ut med en hemmelig nøkkel før en eventuell
Play Store-publisering.
