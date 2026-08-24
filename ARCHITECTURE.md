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
- **Schalen** kent drie standen, in het veld `scales`. `linear` vermenigvuldigt
  gewoon; `taste` schaalt met de wortel van de factor, want twee keer zoveel
  curry heeft geen twee keer zoveel chili nodig; `fixed` hoort bij een bakvorm
  of een blik en verandert nooit mee. Vermenigvuldigen gebeurt eerst, afronden
  daarna, in de eenheid waarin het recept het opschreef: wie "2 el" halveert wil
  "1 el" zien, geen "15 ml".
- **Zonder hoeveelheid.** `amount` en `unit` mogen samen ontbreken. Dat is de
  regel "peper en zout naar smaak": die staat wel bij het recept, maar valt niet
  af te wegen en komt dus ook niet op de boodschappenlijst.
- **Afronden** hangt af van de grootte: onder 5 op halven, onder 20 op eenheden,
  onder 100 op vijven, onder 1000 op tientallen, daarboven op vijftigtallen.
  Stuks ronden af op halven met een half als minimum, een snufje blijft een heel
  snufje.
- **Optellen** gebeurt met de ónafgeronde waarden, en pas het totaal wordt
  afgerond. Anders stapelen afrondingsfouten zich op over meerdere recepten.
- **Omrekenen** tussen dimensies kan alleen via de `conversions` in de
  bibliotheek ("1 ui is 150 g"). Ontbreekt die factor, dan blijven het bewust
  twee regels op de lijst in plaats van één verkeerde optelling.

## Terugschrijven

Wat de app schrijft moet er precies zo uitzien als wat er al staat, anders levert
elke wijziging een onleesbare diff op. `recipeToYaml` gebruikt daarvoor de
yaml-bibliotheek met een vaste veldvolgorde, en de tests dwingen af dat alle
receptbestanden byte voor byte terugkomen. Aanhalingstekens worden bewust niet
met de hand gezet: bij de import ging dat mis omdat een notitie met een komma
binnen accolades de waarde afkapte, zonder foutmelding.

Eén opslagactie kan drie bestanden raken: nieuwe ingrediënten, een foto en het
recept. Die volgorde is niet willekeurig. Het recept gaat als laatste, zodat het
nooit verwijst naar iets dat er nog niet is.

Elke schrijfactie geeft de bestandssha mee die de app kent. Klopt die niet meer,
dan weigert GitHub en krijg je een melding, in plaats van dat een wijziging die
je elders maakte stilletjes verdwijnt. Bij een nieuw recept gaat er juist géén
sha mee: dan weigert GitHub als het bestand al bestaat, en dat is precies de
waarschuwing die je wilt.

Zonder verbinding gaat het recept in een wachtrij in IndexedDB, die bij de
eerstvolgende synchronisatie wordt leeggewerkt. Een botsing op de sha blijft daar
staan met een melding erbij; een netwerkfout stopt de ronde in plaats van de rest
van de wachtrij te verspelen.

### Eén commit voor meerdere bestanden

De Contents API kan maar één bestand per commit. Voor het toevoegen van een
recept is dat genoeg, maar het samenvoegen van twee ingrediënten raakt het
bibliotheekbestand én elk recept dat ernaar verwees. Als losse commits levert dat
een onleesbare geschiedenis op, en erger: het kan halverwege stuklopen en
recepten achterlaten die verwijzen naar een ingrediënt dat niet meer bestaat.

`commitChanges` bouwt daarom via de Git Data API in vier stappen een nieuwe boom
(ref lezen, boom bouwen op `base_tree`, commit maken, branch doorzetten). De
branch wordt zonder `force` doorgezet: is er intussen elders gepusht, dan is het
geen fast-forward en weigert GitHub. Dat is dezelfde bescherming als de sha bij
losse bestanden, maar dan voor de hele wijziging.

## Bibliotheekbeheer

Bewerkingen op de bibliotheek zijn zuivere functies in `domain/ingredients/edits.ts`:
erin gaat de huidige verzameling, eruit komt een nieuwe plus een lijst van welke
bestanden herschreven moeten worden. Geen netwerk, geen bestanden. Daardoor zijn
ze te testen en kan de UI eerst tonen wat er gaat gebeuren.

Twee keuzes zijn de moeite van het onthouden waard:

- **Hernoemen verandert het id niet.** Het id is waar elk recept naar verwijst;
  dat omgooien zou elk receptbestand raken voor een cosmetische wijziging. De
  oude naam blijft als synoniem staan, zodat een geplakt recept met die naam
  blijft koppelen.
- **Samenvoegen bewaart de opgeheven naam als synoniem.** Anders koppelt de
  tekstparser die naam de volgende keer weer aan niets, en begint het opnieuw.

`analyseLibrary` zoekt op wat er scheef staat: receptregels zonder koppeling,
verwijzingen naar een ingrediënt dat niet bestaat, verweesde ingrediënten en
dubbelingen. Dat is het sluitstuk van de keuze om de CI niet te laten falen op
een losse naam: wat er met de hand bij komt mag blijven staan, maar het komt wel
op een lijst in plaats van stil te verdwijnen.

Dubbelingen worden op twee manieren gevonden: een gedeelde naam of synoniem
(hard), en namen die op letterparen sterk op elkaar lijken (zacht). Bij dat
tweede zit één Nederlandse eigenaardigheid ingebouwd: je maakt van een
ingrediënt een ánder product door er een woord achter te plakken. Sinaasappel
wordt sinaasappelsap, witte wijn wordt witte wijnazijn. Die lijken bijna
identiek, terwijl je ze nooit wilt samenvoegen. Een meervoud voegt hooguit een
letter of twee toe, dus daar ligt de grens.

## De voorraadkast

De voorraadkast staat in IndexedDB, niet in de repo. Hij verandert elke dag; dat
bijhouden in git zou een commit per pak melk opleveren, en het is bovendien
niets waar een ander iets aan heeft. Hij gaat wel mee in de export en import,
net als de selectie en de afvinkstatus.

Een regel is `{ ingredientId, amount?, unit?, bestBefore? }`. Hoeveelheid en
datum zijn allebei optioneel, en dat is een bewuste keuze: aanvinken dát je iets
in huis hebt is het meeste waard en kost één tik. Alleen bij dingen die bederven
of waar de hoeveelheid uitmaakt vul je meer in.

Aftrekken gebeurt niet in `buildShoppingList` maar in een aparte stap,
`applyPantry`. Zo hoeft het optellen zelf niets van de voorraadkast te weten en
kan de aftrek met één schakelaar uit. Elke regel krijgt er een `stock` bij met
`volledig`, `deels`, `niet` of `onbekend`.

Die laatste is de eerlijke uitkomst wanneer de eenheden niet te vergelijken
zijn: heb je "1 g olijfolie" staan en vraagt het recept twee eetlepels, dan kan
de app dat zonder omrekenfactor niet beoordelen. Er wordt dan niets afgetrokken
en je ziet staan wat je hebt.

**Een regel verdwijnt nooit stilletjes.** Wat je al hebt blijft zichtbaar,
doorgestreept en gemarkeerd, en zakt naar onderen. In de supermarkt moet je
kunnen zien dát de app iets heeft weggestreept — als het niet klopt, sta je
anders thuis zonder boter.

### Wat telt als ontbrekend

Bij "wat kan ik nu maken" tellen twee soorten regels bewust niet mee: optionele
ingrediënten, en alles wat `scales: taste` is. Zonder die tweede uitzondering
zou elk recept eeuwig melden dat je zout mist en zegt de ranglijst niets meer.
Ze worden apart geteld en blijven zichtbaar. Te weinig hebben telt wél als
missen, maar alleen als er in de voorraadkast én in het recept een hoeveelheid
staat om te vergelijken.

### Restjesmodus

Elk recept dat kool bevat is geen antwoord op "die halve kool moet op": in een
currysaus gaat twee eetlepel kool en die ligt morgen nog in de koelkast. Daarom
kijkt `rankByIngredient` naar het aandeel in het totale gewicht van het gerecht.
Alles wordt daarvoor naar gram gerekend; wat niet om te rekenen valt (een
snufje, een bosje) telt niet mee in het totaal, want anders zou een recept met
veel kruiden kunstmatig zakken.

## De kookmodus

### Timers rekenen met een eindtijd, niet met een restduur

Elke timer bewaart het moment waarop hij afloopt, en bij elke tik wordt opnieuw
naar de klok gekeken. Dat is het hele punt: zodra het scherm uitgaat of je naar
een andere app wisselt, vertraagt of bevriest de browser JavaScript. Een timer
die zelf zou aftellen loopt dan gegarandeerd achter. Nu klopt de tijd altijd,
ook als de app twintig minuten weg is geweest.

Ze staan in IndexedDB, dus ze overleven ook het afsluiten van de app. Bij het
opstarten wordt gekeken wat er intussen verliep; dat blijft als melding staan
maar gaat niet alsnog piepen.

Wat dit **niet** oplost: een telefoon die de app volledig opschort voert
helemaal geen code uit, dus dan hoor je het alarm pas als je terugkomt. Op iOS
gebeurt dat vrijwel altijd. Een echte oplossing daarvoor bestaat niet zonder
server met pushberichten, en dat is precies wat deze app niet wil zijn. Het
staat daarom eerlijk in de README in plaats van dat het weggemoffeld wordt.

Het geluid komt uit de Web Audio API in plaats van uit een geluidsbestand: drie
regels code tegenover een asset die meegebakken en gecachet moet worden. De
audiocontext wordt ontgrendeld op het moment dat je een timer start, want dat is
een tik van de gebruiker en alleen dan mag een browser geluid gaan maken.

### Tijden uit de staptekst

Het `timer`-veld dekt maar een deel af: bij 200 stappen staat er 71 keer een
veld, terwijl er 63 keer een tijd in de tekst staat. Zinnen als "laat het een
halfuur buiten de koelkast liggen" hebben geen veld maar wel een tijd, en een
stap kan er twee bevatten ("laat drie uur stoven en roer elk halfuur even").

`findTimeMentions` herkent daarom getallen met een eenheid, bereiken,
uitgeschreven getallen ("drie uur") en woordtijden ("een kwartier", "anderhalf
uur"), met hun plek in de zin zodat de knop op het juiste woord komt te staan.
Bij een bereik wordt de ondergrens genomen: in de keuken zet je de wekker op het
moment waarop je moet gáán kijken.

Staat de tijd van het veld al in de tekst, dan verschijnt er geen tweede knop
met dezelfde duur.

### Ingrediënten per stap komen uit de tekst

Het schema heeft een veld om een ingrediëntregel aan een stap te koppelen, maar
geen van de recepten gebruikt het — ze komen uit een kookboek en een
Word-document, niet uit een systeem dat die koppeling kende. Wachten tot dat veld
ooit gevuld is zou betekenen dat deze functie jarenlang niets doet, dus wordt er
op naam gezocht: 85% van de stappen krijgt zo minstens één ingrediënt.

Er wordt vergeleken op hele woorden uit een vaste lijst vormen (naam, meervoud,
synoniemen, plus de varianten die de bibliotheek al kent), niet op "zit deze
letterreeks erin". Anders matcht "ui" op "uiteraard". De 8% regels die in geen
enkele stap genoemd worden verschijnen apart bij de laatste stap, zodat ze niet
zoekraken.

## Geschiedenis en planning

### Wat lokaal blijft en wat de repo in gaat

De kookgeschiedenis, favorieten, het weekplan en de bewaarde boodschappenlijsten
staan alleen op dit toestel. Dat is geen technische beperking maar een grens:
het receptbestand beschrijft het gerecht, niet jouw avonden. Wanneer jij iets
kookte en wat je ervan vond hoort niet in een publieke repo, en het zou bij elke
maaltijd een commit opleveren.

Eén ding kan die grens bewust oversteken: een aangepaste hoeveelheid. Die begint
als jouw aanpassing op dit toestel, en pas als je zegt dat het altijd zo moet
gaat hij het receptbestand in. Dat onderscheid is de hele functie — je weet vaak
pas na de tweede of derde keer dat het echt beter is met minder chili.

Aanpassingen worden bewaard op het **basisaantal personen** van het recept, niet
op het aantal dat je toevallig op je scherm hebt staan. Anders zou "150 gram"
iets anders gaan betekenen zodra je van vier naar zes personen schuift.

### Dubbele porties

Een gerecht staat in het plan op de dag dat je het kóókt; extra eetdagen staan
er als lijst bij. Dat onderscheid is de reden dat dit niet gewoon "een recept per
dag" is: de boodschappen moeten kloppen voor twee maaltijden, maar je wilt niet
twee keer dezelfde stoofpot op je weekmenu zien staan. `planToSelections` telt
daarom de porties op over alle eetdagen en levert het gerecht één keer aan.

### Niet twee keer hetzelfde

De verrassingsknop trekt gewogen in plaats van uniform: wat je gisteren kookte
weegt 0,1 en na twee weken weer vol mee. Bewust géén uitsluiting — soms wíl je
die stamppot voor de tweede keer deze maand, en een knop die iets weigert is
irritanter dan een knop die het onwaarschijnlijk maakt.

### Verslepen

Op een muis kun je een gerecht naar een andere dag slepen. Op een telefoon
verplaats je het via het paneel dat opengaat als je erop tikt: slepen met een
vinger over zeven kaarten die niet allemaal tegelijk in beeld passen is daar
onbetrouwbaarder dan zeven dagknoppen.

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

Milestone 1 tot en met 6 dekken kiezen, boodschappen doen, toevoegen vanaf je
telefoon, het beheren van de bibliotheek, de voorraadkast, het koken zelf en het
plannen en terugkijken. Het schema heeft de velden voor
prijs, verpakking en voedingswaarde al, maar ze zijn optioneel en nog leeg;
milestone 7 en 8 vullen ze. Het datamodel is met de latere milestones in het
achterhoofd ontworpen (stapverwijzingen per ingrediënt voor de kookmodus,
timerduur per stap, seizoen, allergenen als gesloten lijst), zodat er onderweg
niets omgegooid hoeft te worden.
