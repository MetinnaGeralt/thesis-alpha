// app/api/fmp/route.js — FMP proxy with stable + v3 fallback
export const dynamic = 'force-dynamic'; // Disable caching

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const key = process.env.FMP_KEY;

  if (!endpoint) {
    return Response.json({ error: 'Missing endpoint param' }, { status: 400 });
  }
  if (!key) {
    console.error('[FMP] FMP_KEY environment variable is not set!');
    return Response.json({ error: 'API key not configured' }, { status: 500 });
  }

  // Parse the endpoint: "income-statement/AAPL?period=annual&limit=5"
  const qIdx = endpoint.indexOf('?');
  const pathPart = qIdx >= 0 ? endpoint.substring(0, qIdx) : endpoint;
  const queryPart = qIdx >= 0 ? endpoint.substring(qIdx + 1) : '';
  const segments = pathPart.split('/');

  // Build URL list to try
  const urls = [];

  if (segments.length >= 2) {
    const ep = segments[0];   // "income-statement"
    const sym = segments[1];  // "AAPL"
    const qs = queryPart ? `&${queryPart}` : '';

    // Stable API (recommended)
    urls.push(`https://financialmodelingprep.com/stable/${ep}?symbol=${sym}${qs}&apikey=${key}`);
    // v3 fallback
    urls.push(`https://financialmodelingprep.com/api/v3/${ep}/${sym}${queryPart ? '?' + queryPart + '&' : '?'}apikey=${key}`);
  } else {
    // Single-segment endpoint (e.g. "search?query=...")
    const sep = endpoint.includes('?') ? '&' : '?';
    urls.push(`https://financialmodelingprep.com/stable/${endpoint}${sep}apikey=${key}`);
    urls.push(`https://financialmodelingprep.com/api/v3/${endpoint}${sep}apikey=${key}`);
  }

  for (const url of urls) {
    const safeUrl = url.replace(key, 'KEY');
    try {
      console.log(`[FMP] Trying: ${safeUrl}`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ThesisAlpha/1.0' },
        cache: 'no-store'
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.log(`[FMP] HTTP ${res.status} for ${safeUrl}: ${body.substring(0, 200)}`);
        continue;
      }

      const text = await res.text();
      if (!text || text.trim() === '' || text.trim() === 'null') {
        console.log(`[FMP] Empty response for ${safeUrl}`);
        continue;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.log(`[FMP] JSON parse error for ${safeUrl}: ${e.message}`);
        continue;
      }

      // Check for FMP error messages
      if (data && typeof data === 'object' && !Array.isArray(data) && data['Error Message']) {
        console.log(`[FMP] API error for ${safeUrl}: ${data['Error Message']}`);
        continue;
      }

      // Skip empty arrays
      if (Array.isArray(data) && data.length === 0) {
        console.log(`[FMP] Empty array for ${safeUrl}`);
        continue;
      }

      // Success!
      console.log(`[FMP] Success for ${safeUrl} — ${Array.isArray(data) ? data.length + ' items' : 'object'}`);
      return Response.json(data);

    } catch (e) {
      console.error(`[FMP] Fetch error for ${safeUrl}:`, e.message);
      continue;
    }
  }

  // All failed
  console.error(`[FMP] ALL URLS FAILED for endpoint: ${endpoint}`);
  return Response.json(null);
}
