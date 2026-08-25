/**
 * De gedeelde logica van de importproxy.
 *
 * Waarom er überhaupt een proxy nodig is: een browser mag `example.com` niet
 * ophalen vanaf `sjoerdhutter.github.io` zonder dat example.com daar met een
 * CORS-header toestemming voor geeft, en dat doet geen enkele receptensite.
 * Dit is het enige stukje van de app dat niet in de browser kan draaien.
 *
 * Wat deze proxy bewust NIET doet: hij leest het recept niet. Hij haalt de
 * pagina op en geeft hem door; het uitpakken gebeurt in de app, waar het te
 * testen is en waar een verbetering geen nieuwe deploy van de proxy vraagt.
 *
 * Dit bestand heeft geen dependencies en gebruikt alleen wat zowel Cloudflare
 * Workers als Netlify Functions aanbieden: fetch, URL en Response.
 */

/** Zo groot mag een opgehaalde pagina of foto zijn. */
export const MAX_BYTES = 5 * 1024 * 1024;

/** Na zoveel milliseconden geeft de proxy het op. */
export const TIMEOUT_MS = 15000;

/**
 * Alleen deze inhoud komt erdoor. Een proxy die alles doorgeeft is een open
 * relay: dan kan iemand anders hem gebruiken om verkeer te verbergen.
 */
const TOEGESTANE_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'application/ld+json',
  'application/json',
  'text/plain',
  'image/',
];

/**
 * Adressen in het eigen netwerk zijn verboden. Zonder deze controle kan iemand
 * die het adres van je proxy kent hem laten praten met wat er verder in dat
 * netwerk draait — dat heet SSRF en het is de klassieke fout bij een proxy.
 *
 * Twee regexen, en dat is met opzet: een naam moet hélemaal kloppen, een
 * IP-adres alleen aan het begin. Eén regex met `^…$` eromheen zou `192.168.`
 * nooit laten matchen op `192.168.1.1` — precies het adres dat je wilt weren.
 */
const VERBODEN_NAMEN = /^(?:localhost|.*\.local|.*\.internal|.*\.localhost|\[?::1\]?)$/i;
const VERBODEN_IP =
  /^(?:0\.|127\.|10\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|f[cd][0-9a-f]{2}:|fe80:)/i;

export class ProxyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Controleert het doeladres en geeft het genormaliseerd terug. */
export function checkTarget(ruw) {
  if (!ruw) throw new ProxyError('Geef de op te halen pagina mee als ?url=…');

  let doel;
  try {
    doel = new URL(ruw);
  } catch {
    throw new ProxyError('Dat is geen geldige URL.');
  }

  if (doel.protocol !== 'https:' && doel.protocol !== 'http:') {
    throw new ProxyError('Alleen http en https worden opgehaald.');
  }
  const host = doel.hostname.replace(/^\[|\]$/g, '');
  if (VERBODEN_NAMEN.test(host) || VERBODEN_IP.test(host)) {
    throw new ProxyError('Adressen in een privénetwerk worden niet opgehaald.', 403);
  }
  return doel;
}

/**
 * De CORS-headers. `allowedOrigin` staat in de omgeving van de proxy; zet hem
 * op de URL van je app en niemand anders kan de proxy vanuit een browser
 * gebruiken.
 */
export function corsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * Haalt de pagina op. Geeft een object terug met de inhoud als bytes, het
 * content-type en de uiteindelijke URL na eventuele omleidingen.
 */
export async function fetchTarget(doel) {
  const afbreken = new AbortController();
  const klok = setTimeout(() => afbreken.abort(), TIMEOUT_MS);

  let antwoord;
  try {
    antwoord = await fetch(doel.toString(), {
      redirect: 'follow',
      signal: afbreken.signal,
      headers: {
        // Zonder een gewone user agent serveren nogal wat sites een lege
        // pagina of een blokkadescherm.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5',
        'Accept-Language': 'nl,en;q=0.8',
      },
    });
  } catch (fout) {
    const reden =
      fout && fout.name === 'AbortError' ? 'duurde te lang' : 'kon niet opgehaald worden';
    throw new ProxyError(`De pagina ${reden}.`, 504);
  } finally {
    clearTimeout(klok);
  }

  if (!antwoord.ok) {
    throw new ProxyError(`De pagina gaf status ${antwoord.status}.`, 502);
  }

  const type = (antwoord.headers.get('content-type') || '').toLowerCase();
  if (!TOEGESTANE_TYPES.some((toegestaan) => type.startsWith(toegestaan))) {
    throw new ProxyError(`Dit type inhoud wordt niet doorgegeven: ${type || 'onbekend'}.`, 415);
  }

  const lengte = Number(antwoord.headers.get('content-length') || '0');
  if (lengte > MAX_BYTES) {
    throw new ProxyError('De pagina is te groot.', 413);
  }

  const bytes = new Uint8Array(await antwoord.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    throw new ProxyError('De pagina is te groot.', 413);
  }

  return { bytes, type: type || 'text/html', finalUrl: antwoord.url || doel.toString() };
}
