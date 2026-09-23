// Cloudflare Pages Function → GET /api/oembed?url=<tweet>
// Devuelve { html } con el embed oficial de X/Twitter para la pestaña Noticias.

const ALLOWED = /^https:\/\/(www\.)?(twitter\.com|x\.com)\/[^/]+\/status\/\d+/i;

const json = (body, status, maxAge) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}`,
      "Access-Control-Allow-Origin": "*",
    },
  });

export async function onRequestGet({ request, waitUntil }) {
  const url = new URL(request.url);
  const tweet = url.searchParams.get("url") || "";
  if (!ALLOWED.test(tweet)) return json({ error: "invalid_url" }, 400, 0);

  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/api/oembed?url=${encodeURIComponent(tweet)}`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const endpoint =
    "https://publish.twitter.com/oembed?omit_script=false&dnt=true&lang=es&url=" +
    encodeURIComponent(tweet.replace("://x.com/", "://twitter.com/"));

  let up;
  try {
    up = await fetch(endpoint);
  } catch (e) {
    return json({ error: "upstream_unreachable" }, 502, 0);
  }
  if (!up.ok) return json({ error: "upstream_status", status: up.status }, 502, 0);

  const data = await up.json();
  const res = json({ html: data.html || null }, 200, 86400); // 1 día
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
