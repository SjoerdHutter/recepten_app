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

| Script              | Wat het doet                         |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Ontwikkelserver met hot reload       |
| `npm run build`     | Productiebuild in `dist/`            |
| `npm run preview`   | De productiebuild lokaal bekijken    |
| `npm test`          | Alle tests (Vitest)                  |
| `npm run typecheck` | TypeScript zonder output             |
| `npm run lint`      | ESLint                               |
| `npm run format`    | Prettier over de hele repo           |
| `npm run validate`  | Elk databestand tegen het Zod-schema |
| `npm run icons`     | De PWA-iconen opnieuw genereren      |

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

Vanaf milestone 2 zit er een invoerformulier in de app dat het bestand schrijft
via de GitHub API. Zonder token genereert dat formulier het complete
receptbestand met een kopieerknop en een link naar het "new file"-scherm van
GitHub.

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

## Eenheden

Uitsluitend metrisch: `g`, `kg`, `ml`, `l`, `tl`, `el`, `stuks`, `snufje`,
`teentje`, `bosje`. Temperaturen in graden Celsius. Bij het optellen worden gram
en kilo samengevoegd, en milliliter en liter ook; een theelepel is 5 ml en een
eetlepel 15 ml. Hoeveelheden worden praktisch afgerond, dus geen 0,333 ei maar
een half ei, en 1500 g wordt 1,5 kg.

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
