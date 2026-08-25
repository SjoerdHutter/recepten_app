# De importproxy

Dit mapje is **optioneel**. Zolang je hem niet instelt, verbergt de app het
importeren vanaf een website gewoon; alle andere functies werken zonder.

## Waarom dit nodig is

De app draait volledig in je browser. Een browser mag `allrecipes.com` niet
ophalen vanaf `sjoerdhutter.github.io`, tenzij die site daar met een
CORS-header expliciet toestemming voor geeft — en dat doet geen enkele
receptensite. Dit is het enige onderdeel van het project dat niet in de browser
kan draaien.

De proxy is bewust dom: hij haalt de pagina op en geeft hem door. Het uitpakken
van het recept gebeurt in de app zelf, waar het te testen is en waar een
verbetering geen nieuwe deploy van de proxy vraagt.

## Wat het kost

Niets, bij dit gebruik. Cloudflare geeft 100.000 verzoeken per dag op het
gratis niveau, Netlify 125.000 per maand. Eén recept importeren kost er twee:
de pagina en de foto.

## Cloudflare Worker (aanrader)

```bash
npx wrangler login
npx wrangler deploy proxy/cloudflare-worker.js --name recepten-proxy
npx wrangler secret put ALLOWED_ORIGIN --name recepten-proxy
# vul in: https://sjoerdhutter.github.io
```

Wrangler noemt aan het eind het adres, iets als
`https://recepten-proxy.<je-account>.workers.dev`. Dat adres plak je in de app
onder **Instellingen ▸ Importeren**.

## Netlify Function

Kopieer `netlify-function.js` en `shared.js` naar `netlify/functions/` in een
Netlify-project en deploy dat. Zet `ALLOWED_ORIGIN` bij **Site configuration ▸
Environment variables**. Het adres wordt dan `https://<project>.netlify.app/import`.

## Zet ALLOWED_ORIGIN

Zonder die variabele staat de proxy voor iedere website open. Met de URL van je
eigen app erin weigert de browser van een ander het antwoord te lezen. Het is
één regel en het scheelt dat je proxy door een vreemde gebruikt wordt.

Dat is geen volledige afscherming — wie het adres kent kan hem buiten een
browser om nog steeds aanroepen. Daarom zitten er drie grenzen in de proxy zelf:

- **Alleen http en https**, en geen adressen in een privénetwerk
  (`localhost`, `10.x`, `192.168.x`, `*.internal`). Zonder die controle kan
  iemand de proxy laten praten met wat er verder in dat netwerk draait.
- **Alleen HTML, JSON, platte tekst en afbeeldingen** komen erdoor.
- **Hoogstens 5 MB en 15 seconden** per verzoek.

Wil je het echt dicht: geef de worker een pad dat niemand kan raden, of zet er
in Cloudflare een Access-regel voor.

## Testen zonder te deployen

```bash
npx wrangler dev proxy/cloudflare-worker.js
curl 'http://localhost:8787/?url=https://example.com' | head -20
```

## Wat er teruggegeven wordt

De pagina zelf, onveranderd, met de CORS-headers erbij en één extra header:
`X-Final-Url`, waar de pagina na eventuele omleidingen vandaan bleek te komen.
De app zet die als bron in het recept, zodat een verkorte link niet als bron
in je repo belandt.

Gaat er iets mis, dan komt er JSON terug met een leesbare Nederlandse melding
in `error`, met een passende statuscode: 403 voor een privéadres, 413 voor te
groot, 415 voor het verkeerde type, 502 voor een pagina die zelf een fout gaf
en 504 bij een time-out.
