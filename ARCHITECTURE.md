# Architectuur

Waarom de app is zoals hij is. Bedoeld om over een halfjaar terug te lezen
voordat je iets omgooit.

## De kern in één alinea

Een statische React-app zonder backend. De recepten zijn YAML-bestanden in deze
repo. De app leest ze tijdens gebruik via de GitHub API, bewaart ze in
IndexedDB en werkt daarna volledig offline. Schrijven gaat met een persoonlijk
token rechtstreeks naar de GitHub Contents API.

## Lagen

```
src/domain/   pure logica: schema's, eenheden, schalen, aggregatie, filters
src/data/     infrastructuur: GitHub, IndexedDB, YAML, synchronisatie
src/state/    React-context: instellingen, gegevens, lokale staat
src/ui/       herbruikbare bouwstenen en de schil
src/features/ de schermen
```

De regel: **`domain/` importeert nooit uit `data/`, `state/`, `ui/` of
`features/`.** Daar zit geen React en geen netwerk in, alleen functies met
invoer en uitvoer. Dat is precies wat de tests dekken, en het is de reden dat de
rekenregels te vertrouwen zijn zonder de app te starten.

## Waarom YAML, en één bestand per recept

De belangrijkste eis was dat een recept ook zonder de app aan te raken te
bewerken moet zijn, op github.com, op een telefoon. In JSON is dat priegelen met
aanhalingstekens en komma's; in YAML typ je gewoon wat je bedoelt. De prijs is
één kleine dependency en gevoeligheid voor inspringing, en die wordt afgevangen
door het schema in de CI.

Ingrediënten staan wél gegroepeerd, één bestand per supermarktcategorie. Met een
bestand per ingrediënt zouden het er tweehonderd worden; nu blader je op GitHub
door één overzichtelijke lijst, en hoeft de app bij een nieuw ingrediënt maar één
bestand te herschrijven.

Prettier blijft van `data/` af (zie `.prettierignore`), zodat de opmaak die de
app schrijft niet vecht met de opmaak die Prettier zou willen.

## Hoe de synchronisatie werkt

Het uitgangspunt: openen is instant en offline volledig, maar een recept dat je
twee minuten geleden toevoegde is er meteen.

1. De app toont direct wat er in IndexedDB staat. Geen laadscherm.
2. Eén verzoek aan de **Git Trees API** (`?recursive=1`) geeft het pad én de
   blob-sha van elk bestand in de repo. Met een `If-None-Match`-header, dus een
   ongewijzigde repo levert een 304 op — en die telt niet mee voor de limiet van
   GitHub.
3. Alleen paden waarvan de sha afwijkt worden opgehaald; verdwenen paden worden
   lokaal verwijderd. Bij twee gewijzigde recepten zijn dat twee verzoeken, niet
   tweehonderd.
4. Parsen en valideren met Zod. Een bestand met een fout blokkeert de rest niet,
   maar verschijnt als melding in de instellingen.

Synchroniseren gebeurt bij het openen, bij terugkeren naar de app (hooguit eens
per vijf minuten) en met de knop in de instellingen.

**Met token** loopt alles via `api.github.com`: 5000 verzoeken per uur en altijd
actueel. **Zonder token** komt de inhoud van `raw.githubusercontent.com`: geen
limiet, wel een CDN-cache van een paar minuten. In leesmodus merk je dat verschil
niet.

### De meegeleverde momentopname

De databestanden worden bij het bouwen mee ingebakken via `import.meta.glob`
(`src/data/snapshot.ts`). Dat is puur een startpunt: bij de allereerste keer
openen staat het kookboek er meteen, in plaats van dat de app tweehonderd losse
bestanden moet ophalen.

Om die momentopname te kunnen vergelijken met de repo berekent de app de
git-blob-sha van elk meegeleverd bestand zelf, in de browser met WebCrypto
(`src/data/sync/sha.ts`, `sha1("blob <lengte>\0<inhoud>")`). Daardoor haalt de
eerste sync alleen op wat ná de laatste deploy is veranderd. Er is dus géén
gegenereerd bestand dat in de repo bijgehouden moet worden.

## Het token

Zie de README voor de risico-afweging. In code gelden drie harde regels:

1. Alle verkeer met een token loopt via `src/data/github/client.ts`. Die bouwt de
   URL met `api.github.com` als basis en gooit een fout als het resultaat een
   ander adres is. Pas dáárna wordt de `Authorization`-header gezet.
2. De service worker cachet niets van `api.github.com`. In
   `vite.config.ts` staat alleen een regel voor afbeeldingen op
   `raw.githubusercontent.com`; geauthenticeerde antwoorden mogen nooit in de
   Cache Storage belanden.
3. `no-console` staat aan in ESLint (behalve `warn` en `error`), zodat een
   debugregel met een token er niet ongemerkt in glipt.

## Rekenregels

- **Dimensies.** Massa rekent in gram, volume in milliliter. Lepels horen bij
  volume (tl = 5 ml, el = 15 ml). "Aantal" is geen gedeelde dimensie: een
  teentje, een bosje en een stuk tellen alleen bij hun eigen soort op.
- **Schalen** vermenigvuldigt en rondt daarna af in de eenheid waarin het recept
  het opschreef. Wie "2 el" halveert wil "1 el" zien, geen "15 ml". Regels met
  `scales: false` blijven staan.
- **Afronden** hangt af van de grootte: onder 5 op halven, onder 20 op eenheden,
  onder 100 op vijven, onder 1000 op tientallen, daarboven op vijftigtallen.
  Stuks ronden af op halven met een half als minimum, een snufje blijft een heel
  snufje.
- **Optellen** gebeurt met de ónafgeronde waarden, en pas het totaal wordt
  afgerond. Anders stapelen afrondingsfouten zich op over meerdere recepten.
- **Omrekenen** tussen dimensies kan alleen via de `conversions` in de
  bibliotheek ("1 ui is 150 g"). Ontbreekt die factor, dan blijven het bewust
  twee regels op de lijst in plaats van één verkeerde optelling.

## Afgeleide waarden staan niet in de bestanden

Totale tijd, kosten per portie en voedingswaarde worden berekend uit wat er wél
staat. Anders zou een prijswijziging in de bibliotheek elk receptbestand moeten
aanraken, en zou een afgeleide waarde kunnen gaan afwijken van zijn bron.

## Keuzes in de UI

- **Hash-routing** (`/#/recept/…`). Op GitHub Pages werkt een diepe link dan
  zonder 404-omweg, ook offline en als geïnstalleerde app.
- **Systeemlettertype.** Een webfont zou bij het eerste bezoek moeten laden en
  in de service worker gecachet moeten worden; het levert niets op wat deze app
  nodig heeft.
- **Donkere modus** via een class op `<html>`, gezet door een klein script in
  `index.html` vóór de eerste tekening. Zonder dat script zie je bij het openen
  een witte flits.
- **Alles minstens 44 px** en geen gedrag dat van hover afhangt. De app wordt
  met natte handen en één duim bediend.
- **Filters staan in de URL**, zodat de terugknop klopt en een gefilterde lijst
  te delen is.

## Wat er nog niet is

Milestone 1 dekt kiezen en boodschappen doen. Het schema heeft de velden voor
prijs, verpakking en voedingswaarde al, maar ze zijn optioneel en nog leeg;
milestone 7 en 8 vullen ze. Het datamodel is met de latere milestones in het
achterhoofd ontworpen (stapverwijzingen per ingrediënt voor de kookmodus,
timerduur per stap, seizoen, allergenen als gesloten lijst), zodat er onderweg
niets omgegooid hoeft te worden.
