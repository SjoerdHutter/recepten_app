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

## Supermarkt en kosten

### De prijzen zijn schattingen, en dat mag je zien

De 192 richtprijzen in de bibliotheek zijn met de hand ingevoerde schattingen
voor een Nederlandse supermarkt, geen gemeten of opgehaalde gegevens. Ze hebben
allemaal een peildatum, en de app toont bij elk bedrag hoeveel regels een prijs
hadden en hoe oud de oudste prijs is. Een bedrag zonder die context suggereert
een nauwkeurigheid die er niet is.

Prijzen zijn per ingrediënt aan te passen in het beheerscherm; de peildatum gaat
dan automatisch mee. De eenheid waarin een prijs staat volgt wat leesbaar is —
per kilo voor wat je op gewicht koopt, per liter voor vloeistoffen, per lepel
voor specerijen — maar moet altijd dezelfde dimensie hebben als waarin recepten
het afmeten, anders valt er niets om te rekenen.

### Verpakkingsafronding

De supermarkt verkoopt geen 150 ml room maar een pak van 250 ml. Dat verschil
staat op de lijst, mét wat je overhoudt, en met een knop naar de recepten die
dat restje opmaken (dezelfde restjeslogica als bij de voorraadkast). Een restje
onder 2% van een verpakking wordt niet gemeld: dat is meetruis.

### Looproute

De categorievolgorde is per winkel in te stellen en er kunnen meerdere
winkelprofielen naast elkaar bestaan. Een opgeslagen profiel wordt bij het
inlezen aangevuld en opgeschoond, zodat het blijft werken als er later een
categorie bijkomt of verdwijnt.

### Export naar een lijstjes-app

Noch Apple Herinneringen noch Google Keep heeft een openbare deeplink om er in
bulk regels in te zetten. Het deelvenster van het toestel is daarom de route:
daar staan die apps in. De export stuurt kale regels zonder de recepten
erachter, want een lijstjes-app wil geen toelichting.

## Voedingswaarde

### Richtwaarden, geen NEVO

De opdracht noemde NEVO als bron. Die gegevens zijn hier niet op te halen — er
is geen open API die de app zonder backend mag bevragen, en de tabel overtypen
zonder hem gezien te hebben zou neerkomen op verzinnen met een geloofwaardig
etiket erop. De 192 waarden in de bibliotheek zijn daarom met de hand ingevoerde
**richtwaarden** voor een gemiddeld product, en ze staan als zodanig in de
bestanden: `source: richtwaarde` met een peildatum. De app toont die bron. Wie
er echte NEVO-cijfers in wil zetten, kan dat per ingrediënt doen in het
beheerscherm; dan verandert `source` mee en blijft de rest werken.

### Dekking hoort bij het getal

Twee dingen maken de optelling onvermijdelijk onvolledig: niet elk ingrediënt
heeft waarden, en niet elke regel is te wegen. `recipeNutrition` telt daarom
naast de totalen ook bij hoeveel gram meegerekend is (`gramsCounted`) en hoeveel
niet (`gramsMissing`), en houdt drie categorieën uit elkaar:

- `known` — gewicht bekend, waarden bekend; telt mee.
- `unknown` — gewicht bekend, waarden niet; drukt de dekking.
- `unweighable` — niet te wegen, zoals een bosje peterselie of "naar smaak".
  Dit drukt de dekking níét: er valt niets te missen wat je had kunnen meten.

Die splitsing is er omdat de kaart anders zichzelf tegensprak ("berekend over
100% van het gewicht; 1 ingrediënt heeft geen gegevens"). `coverage()` deelt
alleen op het weegbare deel, en onder `BETROUWBAAR_VANAF` (80%) zegt de app dat
het getal weinig voorstelt.

### Volume naar gram gaat via milliliter

`convertToBase` zoekt een omrekening op de **bron**eenheid, dus een dichtheid
die als `conversions: { ml: { g: 0.92 } }` in de bibliotheek staat vindt hij
niet bij een hoeveelheid in eetlepels. `gramsOf` rekent daarom eerst naar
milliliter en past de dichtheid pas daarna toe. Zonder die stap lagen 35
ingevulde dichtheden er ongebruikt bij en werd 2 el sojasaus als 30 g gerekend
in plaats van 36 g. Ontbreekt de dichtheid, dan geldt 1 g/ml — goed voor water
en bouillon, zo'n 8% mis bij olie — en wordt de regel geteld in
`assumedDensity`, zodat de app het kan melden.

### Het filter raadt niet

`matchesNutrition` laat een recept met een dekking onder de 80% buiten een
kcal- of eiwitfilter vallen. Het alternatief — het ontbrekende deel schatten —
zou een verzonnen getal als harde grens gebruiken. Liever een recept missen dan
"onder 400 kcal" beloven op grond van een gok. Het is ook de duurste controle in
`matchesFilters` (de hele schaling en optelling per recept), dus hij staat
achteraan, achter alle goedkope afwijzingen.

## Importeren van buitenaf

Dit is het enige deel dat het uitgangspunt "geen backend" raakt, en daarom is
het opgezet als twee losse modules die de app zonder configuratie verbergt. Wie
ze niet instelt merkt niet dat ze bestaan.

### De proxy is met opzet dom

Een browser mag een receptensite niet ophalen vanaf een ander adres; geen enkele
site zet daar een CORS-header voor. Er is dus iets nodig dat op een server
draait. Dat "iets" doet precies één ding: de pagina ophalen en doorgeven. Het
lezen van het recept gebeurt in `src/domain/import/`, waar het te testen is en
waar een verbetering geen nieuwe deploy van de proxy vraagt. De worker en de
Netlify-functie delen `proxy/shared.js` en gebruiken alleen web-API's die ze
allebei aanbieden; er zit geen enkele dependency in.

Een open proxy is een cadeau aan een vreemde, dus er zitten vier grenzen in:
`ALLOWED_ORIGIN` voor de CORS-header, alleen http en https, alleen HTML/JSON/
tekst/afbeeldingen, en hoogstens 5 MB en 15 seconden.

De belangrijkste is de controle op privéadressen. Die zat er meteen in, maar
werkte niet: één regex met `^…$` eromheen waar `192\.168\.` in stond, en dat
matcht `192.168.1.1` natuurlijk niet in zijn geheel. Elk adres in het eigen
netwerk kwam er gewoon doorheen — de klassieke SSRF-fout. Het zijn nu twee
regexen: een naam moet helemaal kloppen, een IP-adres alleen aan het begin. Er
staan tests op in `src/data/import/proxyGuard.test.ts`, die het echte
proxybestand importeren.

### JSON-LD, niet de opmaak van de pagina

Vrijwel elke receptensite zet `schema.org/Recipe` als JSON-LD in de bron, want
Google gebruikt dat voor de zoekresultaten. Dat blok lezen is oneindig veel
betrouwbaarder dan de HTML uitpluizen, en het is overal hetzelfde. De parser is
bestand tegen wat sites er in de praktijk van maken: een `@graph`, meerdere
blokken, één stukgeslagen blok, `HowToSection` met stappen erin, instructies als
lap HTML, en `recipeYield` in vijf smaken.

Twee afleidingen die de moeite waard zijn:

- **Passieve tijd komt uit het verschil.** Staat er een `cookTime` én een
  `totalTime`, dan is wat overblijft wachten: rijzen, marineren, afkoelen. Dat
  onderscheid is het belangrijkste veld van dit model, dus het zou zonde zijn om
  die informatie weg te gooien.
- **`recipeYield` is dubbelzinnig.** "24 cookies" zijn geen 24 porties. Het
  getal is nog steeds het beste dat er is, maar of het om personen gaat blijkt
  alleen uit het woord ernaast. `parseYield` geeft dat er los bij terug, zodat
  de controlestap het kan melden in plaats van te doen alsof.

### Volume gaat naar milliliter, nooit rechtstreeks naar gram

Een cup meel weegt 120 g en een cup suiker 200 g. `foreign.ts` rekent daarom
alleen om binnen dezelfde dimensie; het wegen laat het over aan de dichtheden in
de bibliotheek, die bij de voedingswaarde toch al nodig waren. Liever niets
omrekenen dan iets verkeerd omrekenen.

### Het model typt over, meer niet

Bij de foto-import krijgt het taalmodel één opdracht: overschrijven wat er staat,
in dezelfde losse regels als een receptensite ze levert. Het rekent niets om en
koppelt niets. Alles daarna — `parseImportLine`, de eenheden, de temperatuur,
de bibliotheek — is dezelfde code als bij de URL-import. Zo is er één plek waar
het mis kan gaan in plaats van twee, en die plek is getest.

Wat het model teruggeeft gaat door een Zod-schema, want het is een gok over wat
er op een foto staat en niet iets om op te vertrouwen. Woorden die het niet kon
lezen horen in `unreadable` en komen als niet-geplaatste regels terug; raden is
erger dan een gat, want een gat zie je. In de controlestap staat altijd dat een
taalmodel dit heeft overgetypt.

De API-sleutel volgt dezelfde regels als het GitHub-token: localStorage,
uitsluitend naar `api.anthropic.com`, nooit in een URL of logregel, niet in de
back-up.

### Drie routes, één controlestap

Plakken, een URL en een foto komen alle drie uit op een `ParsedRecipe` en
daarmee op `neemOver` in het formulier. Er is geen route die de controle
overslaat, en velden die de bron niet gevonden heeft blijven staan zoals ze
stonden — een import wist nooit iets wat je al had ingevuld.

Van de trefwoorden die een site meelevert blijft alleen over wat de app al als
tag kent. "easy weeknight dinner" en "30 minute meals" horen niet als filter in
een persoonlijk kookboek.

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

## Wat er wel en niet nagelopen is

Alle negen milestones staan er: kiezen, boodschappen doen, toevoegen vanaf je
telefoon, het beheren van de bibliotheek, de voorraadkast, het koken zelf, het
plannen en terugkijken, de supermarkt met de kosten, de voedingswaarde en het
importeren van buitenaf.

Eén ding is eerlijk te melden: de aanroep naar het taalmodel in
`src/data/import/askModel.ts` is nooit met een echte sleutel gedraaid — die is
er hier niet, en het is niet aan mij om er een te kopen. Het omzetten van wat
het model teruggeeft naar een recept is wél getest, met vastgelegde antwoorden
in `photo.test.ts`, en de foutafhandeling (401, 429, leeg antwoord, geen JSON)
zit erin. De eerste keer dat je die knop gebruikt ben je dus de eerste die het
hele pad loopt. De URL-import is wel end-to-end nagelopen, met de echte
proxycode uit `proxy/shared.js` en een neppe receptensite ernaast.
