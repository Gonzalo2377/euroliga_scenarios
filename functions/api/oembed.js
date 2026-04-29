export async function onRequest(context) {
    const tweetUrl = new URL(context.request.url).searchParams.get('url');
    const res = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&theme=light&dnt=true`
    );
    const data = await res.json();
    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
