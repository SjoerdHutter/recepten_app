# Recepten

Een persoonlijk kookboek als webapp: recepten zoeken en filteren, hoeveelheden
schalen naar het aantal personen, en er in één keer een opgetelde
boodschappenlijst uit rollen. De app draait als statische site op GitHub Pages,
werkt volledig offline en is op je telefoon te installeren.

De recepten zelf zijn gewone YAML-bestanden in [`data/`](data/). Je kunt ze in de
app aanpassen, maar net zo goed rechtstreeks op github.com.

## Snel starten

```bash
npm install
npm run dev
```

De app draait dan op <http://localhost:5173/recepten_app/>. Alle recepten en
ingrediënten worden bij het bouwen meegeleverd, dus ook zonder internet en zonder
token zie je meteen een gevulde app.

### Alle scripts

| Script              | Wat het doet                                           |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Ontwikkelserver met hot reload                         |
| `npm run build`     | Productiebuild in `dist/`                              |
| `npm run preview`   | De productiebuild lokaal bekijken                      |
| `npm test`          | Alle tests (Vitest)                                    |
| `npm run typecheck` | TypeScript zonder output                               |
| `npm run lint`      | ESLint                                                 |
| `npm run format`    | Prettier over de hele repo                             |
| `npm run validate`  | Elk databestand tegen het Zod-schema                   |
| `npm run report`    | Wat er in de bibliotheek op te ruimen valt             |
| `npm run link`      | Losse ingrediëntnamen koppelen (`-- --write` past toe) |
| `npm run icons`     | De PWA-iconen opnieuw genereren                        |

## Deployen

De app staat op `https://sjoerdhutter.github.io/recepten_app/` en wordt bij elke
push naar `main` opnieuw gebouwd en gepubliceerd door
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

**Dit moet je één keer met de hand instellen:** ga in deze repo naar
**Settings → Pages** en zet **Source** op **GitHub Actions**. Zonder die
instelling kan de workflow niet publiceren.

Heet de repo anders? Pas dan `BASE` in [`vite.config.ts`](vite.config.ts) en
`REPO` in [`src/config.ts`](src/config.ts) aan.

## Het GitHub-token

Zonder token werkt de app in **leesmodus**: alles lezen, zoeken, schalen en
boodschappenlijsten maken. Met een token kun je vanaf milestone 2 ook recepten
toevoegen en aanpassen vanuit de app zelf.

### Aanmaken

1. Ga naar <https://github.com/settings/personal-access-tokens/new>.
2. **Token name**: bijvoorbeeld `receptenapp telefoon`.
3. **Resource owner**: je eigen account.
4. **Repository access**: _Only select repositories_ → alleen
   `SjoerdHutter/recepten_app`.
5. **Permissions → Repository permissions**: zet **Contents** op
   **Read and write**. Verder niets. Metadata wordt automatisch op read gezet;
   dat is normaal en nodig.
6. **Expiration**: kies een termijn die bij je past. Loopt het token af, dan
   valt de app terug in leesmodus en maak je een nieuw token aan.
7. Kopieer het token en plak het in de app onder **Instellingen →
   GitHub-token**.

### Het risico, expliciet

Het token wordt opgeslagen in de **localStorage** van je browser. Dat is geen
versleutelde kluis: elk stuk JavaScript dat op dezelfde oorsprong draait kan
erbij, en wie fysiek toegang heeft tot een ontgrendeld toestel ook.

Waarom dat hier acceptabel is:

- De app heeft geen backend. Er ís geen veiliger plek om het te bewaren zonder
  server, en een server is precies wat dit project niet wil.
- Het token is _fine-grained_ en heeft toegang tot **één** repo, met alleen
  rechten op de inhoud. Het kan geen andere repositories lezen, geen instellingen
  wijzigen, geen repo's verwijderen en niets namens je account doen buiten deze
  repo om.
- Wat er in die repo staat is toch al openbaar. Het ergste dat iemand met het
  token kan doen is jouw recepten aanpassen — vervelend, maar volledig terug te
  draaien met de git-geschiedenis.
- Het token wordt **uitsluitend** naar `api.github.com` gestuurd. De client
  weigert de `Authorization`-header aan een ander adres mee te geven, staat nooit
  in een URL en wordt nooit gelogd of in de service-worker-cache bewaard.
- De back-upfunctie exporteert het token bewust **niet**.

Doe het niet op een gedeeld of onbeheerd toestel. Vertrouw je het niet meer, dan
trek je het token in op GitHub; dat werkt onmiddellijk, ook als het nog ergens in
een browser staat.

> De repo is publiek. Zet daarom nooit een token in een bestand, een commit of
> een screenshot. `.env`-bestanden staan in `.gitignore`.

## Een recept toevoegen

### In de app

Druk op de plusknop rechtsonder in het overzicht. Het formulier loopt in zes
blokken door het recept heen: basis, tijd en vorm, ingrediënten, stappen,
kenmerken en opslaan. Een paar dingen die het op een telefoon prettig maken:

- **Plakken.** Heb je de tekst van een recept ergens vandaan? Plak hem in één
  keer; de app haalt eruit wat hij herkent en jij loopt het na.
- **Ingrediënten** hebben autocomplete op de bibliotheek, en eenheden kies je
  met knoppen in plaats van uit een lijst met veertien opties.
- **Een onbekend ingrediënt** voeg je meteen toe aan de bibliotheek; de app
  vraagt alleen om een schap en een eenheid.
- **Een foto** maak je met de camera of kies je uit je galerij. Hij wordt
  verkleind naar maximaal 1200 pixels en opgeslagen als webp.
- **Zonder bereik** wordt het recept als concept bewaard en vanzelf gecommit
  zodra je weer online bent. Het aantal wachtende concepten staat in de balk
  bovenaan.
- **Bestaande recepten** bewerk en verwijder je met de knoppen onderaan het
  recept.

Zonder token werkt hetzelfde formulier in leesmodus: het laatste blok toont het
complete receptbestand met een kopieerknop en een link naar het "new
file"-scherm van GitHub.

### Rechtstreeks op GitHub

Kan nu al, ook vanaf je telefoon:

1. Ga naar [`data/recipes/`](data/recipes/) en klik op **Add file → Create new file**.
2. Noem het bestand `mijn-recept.yaml`. **De bestandsnaam moet gelijk zijn aan
   het `id` in het bestand.**
3. Neem een bestaand recept als voorbeeld, bijvoorbeeld
   [`hollandse-runderstoof.yaml`](data/recipes/hollandse-runderstoof.yaml).
4. Commit. De CI controleert het bestand tegen het schema; is er iets mis, dan
   zie je dat als rode vink bij de commit.
5. Open de app en trek het scherm omlaag of druk op **Vernieuwen** in de
   instellingen. Het nieuwe recept staat er binnen een paar seconden in, zonder
   dat er iets gedeployed hoeft te worden.

Verwijst een recept naar een ingrediënt dat nog niet bestaat, voeg het dan toe
aan het bestand van de juiste categorie in
[`data/ingredients/`](data/ingredients/). Zonder koppeling telt de
boodschappenlijst het niet netjes op.

## Koken

Op een recept staat **Aan de slag**. Dat opent de kookmodus: één stap tegelijk,
groot genoeg om vanaf het aanrecht te lezen, met het scherm dat aan blijft.

- **Ingrediënten per stap** staan erboven, al meegeschaald naar het aantal
  personen dat je koos.
- **Tijden in de tekst zijn knoppen.** Staat er "laat het een halfuur buiten de
  koelkast liggen", dan tik je op _een halfuur_ en de wekker loopt. Ook
  uitgeschreven tijden ("drie uur") en bereiken ("20 tot 25 minuten", waarbij de
  ondergrens wordt genomen).
- **Stappen worden afgevinkt** als je doorklikt, dus na een onderbreking zie je
  op het recept staan waar je gebleven was.
- **Omrekenen** helpt met ovenschalen, blik naar vers en droog naar gekookt.

### Over de timers

Timers lopen door als je de app wegklikt: ze rekenen met een eindtijd en kijken
bij terugkomst opnieuw naar de klok. Ze overleven ook het afsluiten van de app.

Eén beperking, eerlijk gezegd: als je telefoon de app volledig opschort, wordt er
geen enkele regel code uitgevoerd en hoor je het alarm pas zodra je terugkomt.
Op iOS gebeurt dat vrijwel altijd. Daar is niets aan te doen zonder een server
met pushberichten, en dat is precies wat deze app niet wil zijn. Zet voor een
stoofpot van drie uur dus liever ook de wekker van je telefoon.

## De voorraadkast

Onder het tabblad **Voorraad** vink je aan wat je in huis hebt. Alleen aanvinken
is genoeg; een hoeveelheid en een houdbaarheidsdatum mag je erbij zetten, maar
hoeft niet.

Dat levert drie dingen op:

- **De boodschappenlijst trekt het af.** Heb je 200 g ui staan en vraagt het
  recept er drie, dan staat er nog anderhalve ui op je lijst. Wat je helemaal in
  huis hebt blijft staan, doorgestreept en gemarkeerd — het verdwijnt nooit
  stilletjes, want in de winkel wil je kunnen zien dát de app iets wegstreepte.
  Met de schakelaar bovenaan de lijst zet je het uit.
- **"Wat kan ik maken"** zet de gerechten waarvoor je alles in huis hebt
  bovenaan, daarna die waarvoor je er nog één of twee mist. Optionele
  ingrediënten en dingen naar smaak tellen niet mee als missend; anders zou elk
  gerecht eeuwig melden dat je zout mist.
- **Bijna over.** Vul je een houdbaarheidsdatum in, dan verschijnt het bovenaan
  zodra het bijna zover is, met de knop **Wat kan ik ermee?**

Die laatste knop is de restjesmodus, ook los te openen via elk ingrediënt in je
kast. Hij toont niet elk recept waar het in zit — in een currysaus gaat twee
eetlepel kool en die ligt morgen nog in de koelkast. Standaard zie je alleen
gerechten waarin het ingrediënt echt de hoofdmoot is, met het aandeel erbij.

Na het boodschappen doen verplaatst één knop alles wat je afvinkte naar je
voorraadkast.

De voorraadkast staat alleen op dit toestel en gaat mee in de back-up bij
Instellingen.

## De ingrediëntenbibliotheek

Onder **Instellingen ▸ Ingrediëntenbibliotheek** staat elk canoniek ingrediënt
waar de recepten naar verwijzen. Je kunt er zoeken, en per ingrediënt de naam,
het meervoud, de synoniemen, het schap en de standaardeenheid aanpassen.

Twee dingen om te weten:

- **Hernoemen verandert het id niet.** Daar verwijzen de recepten naar. De oude
  naam blijft als synoniem staan, zodat een geplakt recept met die naam blijft
  koppelen.
- **Samenvoegen** laat het ene ingrediënt verdwijnen en zet alles wat ernaar
  verwees om naar het andere — bibliotheekbestand en recepten samen, in één
  commit.

Het tabblad **Opruimen** zoekt op wat er scheef staat: receptregels zonder
koppeling (met meteen een voorstel), verwijzingen naar een ingrediënt dat niet
bestaat, mogelijke dubbelingen en ingrediënten die geen enkel recept gebruikt.
Dat laatste is geen fout: een startbibliotheek hoort ruimer te zijn dan wat je
deze week kookt.

Hetzelfde werk kan vanaf de opdrachtregel, handig als het er veel zijn:

```bash
npm run report            # wat is er aan de hand
npm run link              # welke losse namen gekoppeld kunnen worden
npm run link -- --write   # en dat toepassen
```

Met **Import** plak je een JSON-export of een lijst met namen, één per regel,
optioneel met schap en eenheid erachter:

```
sjalot
sereh | kruiden | stengel
pastinaak | groente-en-fruit | stuks
```

Wat al bestaat wordt overgeslagen, ook als het onder een synoniem bekend is. Met
**Exporteren** haal je de hele bibliotheek als JSON binnen.

## Eenheden

Uitsluitend metrisch: `g`, `kg`, `ml`, `l`, `tl`, `el`, `stuks`, `snufje`,
`teentje`, `bosje`, `stengel`, `takje`, `blad`. Een regel mag ook helemaal geen
hoeveelheid hebben; dat is "peper en zout naar smaak". Temperaturen in graden Celsius. Bij het optellen worden gram
en kilo samengevoegd, en milliliter en liter ook; een theelepel is 5 ml en een
eetlepel 15 ml. Hoeveelheden worden praktisch afgerond, dus geen 0,333 ei maar
een half ei, en 1500 g wordt 1,5 kg. Kruiden en zout schalen met de wortel van
de factor (`scales: taste`), want dubbel zoveel curry heeft geen dubbele
hoeveelheid chili nodig.

## Later: importeren van buitenaf

Milestone 9 voegt twee optionele modules toe die de app verbergt zolang je ze
niet instelt: importeren vanaf een receptensite (via een kleine eigen proxy,
omdat de browser die pagina's niet rechtstreeks mag ophalen) en een foto van een
kookboekpagina omzetten met een taalmodel (met je eigen API-sleutel). Beide
komen in de instellingen te staan zodra ze er zijn.

## Verder lezen

[`ARCHITECTURE.md`](ARCHITECTURE.md) legt uit waarom de app zo in elkaar zit:
hoe de synchronisatie met sha's werkt, waarom de recepten YAML zijn en waar de
grens tussen de lagen ligt.
