import { ProxyError, checkTarget, corsHeaders, fetchTarget } from './shared.js';

/**
 * Dezelfde importproxy als Netlify Function.
 *
 * Deployen: kopieer dit bestand én `shared.js` naar `netlify/functions/` in een
 * (leeg) Netlify-project, zet `ALLOWED_ORIGIN` bij de omgevingsvariabelen, en
 * deploy. Het adres wordt dan
 * `https://<project>.netlify.app/.netlify/functions/netlify-function`.
 *
 * Dit is de Netlify Functions v2-vorm: één functie die een `Request` krijgt en
 * een `Response` teruggeeft, precies zoals de Worker. Daardoor kunnen ze
 * dezelfde `shared.js` gebruiken.
 *
 * Het gratis niveau geeft 125.000 aanroepen per maand.
 */
export default async (request) => {
  const cors = corsHeaders(process.env.ALLOWED_ORIGIN);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'GET') {
    return new Response('Alleen GET.', { status: 405, headers: cors });
  }

  try {
    const doel = checkTarget(new URL(request.url).searchParams.get('url'));
    const { bytes, type, finalUrl } = await fetchTarget(doel);
    return new Response(bytes, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': type,
        'X-Final-Url': finalUrl,
        'Access-Control-Expose-Headers': 'X-Final-Url',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (fout) {
    const status = fout instanceof ProxyError ? fout.status : 500;
    const bericht = fout instanceof ProxyError ? fout.message : 'Er ging iets mis in de proxy.';
    return new Response(JSON.stringify({ error: bericht }), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
};

export const config = { path: '/import' };
