import { ProxyError, checkTarget, corsHeaders, fetchTarget } from './shared.js';

/**
 * De importproxy als Cloudflare Worker.
 *
 * Deployen:
 *   npx wrangler deploy proxy/cloudflare-worker.js --name recepten-proxy
 *   npx wrangler secret put ALLOWED_ORIGIN   (of zet hem in wrangler.toml)
 *
 * Zet daarna het adres van de worker in de app onder Instellingen ▸
 * Importeren. Zie proxy/README.md voor de stappen met plaatjes erbij.
 *
 * Het gratis niveau van Cloudflare geeft 100.000 verzoeken per dag. Een recept
 * importeren kost er twee (de pagina en de foto), dus daar kom je niet aan.
 */
export default {
  async fetch(request, env) {
    const cors = corsHeaders(env.ALLOWED_ORIGIN);

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
          // Waar de pagina uiteindelijk vandaan kwam; de app zet dat als bron
          // in het recept, zodat een omleiding niet de verkeerde URL oplevert.
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
  },
};
