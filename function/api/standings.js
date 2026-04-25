export async function onRequest(context) {
  const url = new URL(context.request.url);
  const origin = context.request.headers.get('Origin') || '';

  // Reenvía los mismos query params a la API real
  const apiUrl = `https://euroleague-advanced-api.eu/Euroleague/standings${url.search}`;

  const apiRes = await fetch(apiUrl, {
    headers: { 'Accept': 'application/json' }
  });

  const data = await apiRes.text();

  return new Response(data, {
    status: apiRes.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin || 'https://euroleaguecalculator.online',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
