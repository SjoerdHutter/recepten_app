import { PHOTO_PROMPT } from '../../domain/import/photo';

/**
 * De foto naar het taalmodel sturen.
 *
 * Net als bij het GitHub-token geldt hier: de sleutel gaat uitsluitend naar dit
 * ene adres, staat nooit in een URL, wordt nooit gelogd en gaat niet mee in een
 * back-up. Zie de README.
 *
 * De header `anthropic-dangerous-direct-browser-access` is nodig om vanuit een
 * browser te mogen bellen. De naam is streng bedoeld: hij is er omdat een
 * sleutel in een gewone website in het openbaar zou staan. Hier zit hij in de
 * browser van één persoon op zijn eigen toestel, en dat is precies het geval
 * waarvoor het bedoeld is.
 */

const API = 'https://api.anthropic.com/v1/messages';

export class ModelError extends Error {}

/** Een bestand naar base64, in stukken zodat een grote foto de stack niet omgooit. */
const toBase64 = async (bestand: Blob): Promise<string> => {
  const bytes = new Uint8Array(await bestand.arrayBuffer());
  let binair = '';
  const stap = 0x8000;
  for (let i = 0; i < bytes.length; i += stap) {
    binair += String.fromCharCode(...bytes.subarray(i, i + stap));
  }
  return btoa(binair);
};

interface ModelAntwoord {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

export const askModelAboutPhoto = async (
  bestand: Blob,
  apiKey: string,
  model: string,
): Promise<string> => {
  const mediaType = bestand.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const data = await toBase64(bestand);

  let antwoord: Response;
  try {
    antwoord = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
              { type: 'text', text: PHOTO_PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new ModelError('Het model was niet bereikbaar. Heb je verbinding?');
  }

  const inhoud = (await antwoord.json().catch(() => ({}))) as ModelAntwoord;

  if (!antwoord.ok) {
    if (antwoord.status === 401) throw new ModelError('De API-sleutel werd niet geaccepteerd.');
    if (antwoord.status === 429) {
      throw new ModelError('Te veel verzoeken achter elkaar. Probeer het zo nog eens.');
    }
    // De melding van de API kan de sleutel niet bevatten, maar hem toch maar
    // niet klakkeloos doorgeven: alleen de tekst, nooit het hele antwoord.
    throw new ModelError(inhoud.error?.message ?? `Het model gaf status ${antwoord.status}.`);
  }

  const tekst = (inhoud.content ?? [])
    .filter((deel) => deel.type === 'text')
    .map((deel) => deel.text ?? '')
    .join('\n')
    .trim();

  if (!tekst) throw new ModelError('Het model gaf een leeg antwoord.');
  return tekst;
};
