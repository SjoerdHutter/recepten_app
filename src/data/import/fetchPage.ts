/**
 * Praten met de importproxy.
 *
 * De proxy geeft de pagina onveranderd door met de CORS-headers erbij; het
 * lezen van het recept gebeurt in de domeinlaag. Deze module doet niets anders
 * dan ophalen, de fouten van de proxy vertalen naar iets leesbaars, en de
 * uiteindelijke URL teruggeven — een verkorte link of een omleiding mag niet
 * als bron in de repo belanden.
 */

export interface FetchedPage {
  html: string;
  /** Waar de pagina na omleidingen vandaan bleek te komen. */
  url: string;
}

export class ImportError extends Error {}

const proxyUrl = (proxy: string, doel: string): string =>
  `${proxy.replace(/\/+$/, '')}${proxy.includes('?') ? '&' : '?'}url=${encodeURIComponent(doel)}`;

const foutTekst = async (antwoord: Response): Promise<string> => {
  try {
    const inhoud = (await antwoord.json()) as { error?: string };
    if (inhoud.error) return inhoud.error;
  } catch {
    /* geen JSON: dan de statuscode maar */
  }
  return `De proxy gaf status ${antwoord.status}.`;
};

/** Controleert wat je in het invoerveld plakt voordat er een verzoek uit gaat. */
export const normalizeRecipeUrl = (invoer: string): string => {
  const schoon = invoer.trim();
  if (!schoon) throw new ImportError('Plak eerst een adres.');
  const metSchema = /^https?:\/\//i.test(schoon) ? schoon : `https://${schoon}`;
  try {
    const url = new URL(metSchema);
    if (!url.hostname.includes('.')) throw new Error('geen host');
    return url.toString();
  } catch {
    throw new ImportError('Dat lijkt geen webadres. Plak de link naar het recept.');
  }
};

export const fetchRecipePage = async (proxy: string, doel: string): Promise<FetchedPage> => {
  const url = normalizeRecipeUrl(doel);
  let antwoord: Response;
  try {
    antwoord = await fetch(proxyUrl(proxy, url), { headers: { Accept: 'text/html' } });
  } catch {
    throw new ImportError(
      'De proxy is niet bereikbaar. Klopt het adres bij Instellingen, en heb je verbinding?',
    );
  }
  if (!antwoord.ok) throw new ImportError(await foutTekst(antwoord));

  const html = await antwoord.text();
  if (!html.trim()) throw new ImportError('De pagina kwam leeg terug.');

  return { html, url: antwoord.headers.get('X-Final-Url') ?? url };
};

/**
 * De foto van de bronpagina, ook via de proxy: een browser mag hem wel tonen,
 * maar niet uitlezen om er bytes van te maken die we kunnen committen.
 */
export const fetchRecipeImage = async (proxy: string, doel: string): Promise<File> => {
  const antwoord = await fetch(proxyUrl(proxy, doel));
  if (!antwoord.ok) throw new ImportError(await foutTekst(antwoord));
  const blob = await antwoord.blob();
  if (!blob.type.startsWith('image/')) throw new ImportError('Dat was geen afbeelding.');
  return new File([blob], 'bron.jpg', { type: blob.type });
};
