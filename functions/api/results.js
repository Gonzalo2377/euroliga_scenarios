// Cloudflare Pages Function → GET /api/results?season=E2026
// Proxy con caché para la API oficial de la EuroLeague.
// Devuelve un JSON compacto { season, updated, games: [...] } que index.html sabe leer.

const UPSTREAM = (season) =>
  `https://api-live.euroleague.net/v2/competitions/E/seasons/${season}/games`;

function normalizeSide(s) {
  s = s || {};
  const p = s.partials || {};
  let q = [p.partials1, p.partials2, p.partials3, p.partials4];
  let ex = p.extraPeriods;
  if (ex && !Array.isArray(ex)) ex = Object.keys(ex).sort((a, b) => a - b).map((k) => ex[k]);
  q = q.concat(ex || []).map((x) => (x === null || x === undefined || x === "" ? null : Number(x)));
  while (q.length && (q[q.length - 1] === null || (q.length > 4 && q[q.length - 1] === 0))) q.pop();
  return {
    name: (s.club && (s.club.name || s.club.abbreviatedName)) || "",
    code: (s.club && s.club.code) || "",
    score: s.score === null || s.score === undefined ? null : Number(s.score),
    q: q.every((x) => x === null) ? [] : q.map((x) => x || 0),
  };
}

function normalizeGame(g) {
  const home = normalizeSide(g.local);
  const away = normalizeSide(g.road);
  const status = String(g.gameStatus || "").toLowerCase();
  return {
    code: Number(g.gameCode),
    round: Number(g.round) || 0,
    phase: String((g.phaseType && g.phaseType.code) || "RS").toUpperCase(),
    date: g.utcDate || g.date || null,
    played: g.played === true,
    live:
      g.played !== true &&
      (status.includes("live") || status.includes("progress") || (home.score || 0) + (away.score || 0) > 0),
    home,
    away,
  };
}

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
  const qs = url.searchParams.get("season") || "";
  const season = /^E20\d{2}$/.test(qs) ? qs : "E2026";

  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/api/results?season=${season}`, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let upstream;
  try {
    upstream = await fetch(UPSTREAM(season), { headers: { Accept: "application/json" } });
  } catch (e) {
    return json({ error: "upstream_unreachable" }, 502, 0);
  }
  if (!upstream.ok) return json({ error: "upstream_status", status: upstream.status }, 502, 0);

  let raw;
  try {
    raw = await upstream.json();
  } catch (e) {
    return json({ error: "upstream_invalid_json" }, 502, 0);
  }
  const rows = Array.isArray(raw) ? raw : raw.data || raw.Data || [];
  const games = rows.map(normalizeGame).filter((g) => Number.isFinite(g.code));

  // 30 s si hay algo en directo, 5 min si no
  const ttl = games.some((g) => g.live) ? 30 : 300;
  const res = json({ season, updated: new Date().toISOString(), games }, 200, ttl);
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
