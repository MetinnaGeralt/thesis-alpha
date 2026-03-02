// app/api/fmp/route.js — Handles both FMP v3 and stable API formats
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const key = process.env.FMP_KEY;

  if (!endpoint || !key) {
    return Response.json({ error: 'Missing endpoint or API key' }, { status: 400 });
  }

  const separator = endpoint.includes('?') ? '&' : '?';

  // Build URLs to try (v3 first since it's the known working format)
  const urls = [];

  // 1. Standard v3 format: /api/v3/income-statement/AAPL?period=annual
  urls.push(`https://financialmodelingprep.com/api/v3/${endpoint}${separator}apikey=${key}`);

  // 2. Stable API format: /stable/income-statement?symbol=AAPL&period=annual
  // Need to extract symbol from path and convert to query param
  const stableUrl = buildStableUrl(endpoint, key);
  if (stableUrl) urls.push(stableUrl);

  // 3. v4 format for some endpoints
  urls.push(`https://financialmodelingprep.com/api/v4/${endpoint}${separator}apikey=${key}`);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ThesisAlpha/1.0' },
        next: { revalidate: 300 }
      });

      if (!res.ok) {
        console.log(`[FMP] ${res.status} for ${url.replace(key, 'KEY')}`);
        continue;
      }

      const data = await res.json();

      // Check for FMP error responses
      if (data && data['Error Message']) {
        console.log(`[FMP] Error: ${data['Error Message']} for ${url.replace(key, 'KEY')}`);
        continue;
      }

      // Skip empty arrays (wrong endpoint/tier)
      if (Array.isArray(data) && data.length === 0) {
        console.log(`[FMP] Empty array for ${url.replace(key, 'KEY')}`);
        continue;
      }

      // Valid data found
      if (data !== null && data !== undefined) {
        return Response.json(data);
      }
    } catch (e) {
      console.warn(`[FMP] Fetch error for ${url.replace(key, 'KEY')}:`, e.message);
      continue;
    }
  }

  // All URLs failed
  console.log(`[FMP] All URLs failed for endpoint: ${endpoint}`);
  return Response.json(null);
}

function buildStableUrl(endpoint, key) {
  try {
    // Parse: "income-statement/AAPL?period=annual&limit=5"
    // Into: "/stable/income-statement?symbol=AAPL&period=annual&limit=5"
    const [pathPart, queryPart] = endpoint.split('?');
    const pathSegments = pathPart.split('/');

    if (pathSegments.length >= 2) {
      const endpointName = pathSegments[0]; // e.g. "income-statement"
      const symbol = pathSegments[1]; // e.g. "AAPL"

      let url = `https://financialmodelingprep.com/stable/${endpointName}?symbol=${symbol}`;
      if (queryPart) url += `&${queryPart}`;
      url += `&apikey=${key}`;
      return url;
    }

    // Single segment endpoints (no symbol in path)
    return `https://financialmodelingprep.com/stable/${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${key}`;
  } catch (e) {
    return null;
  }
}
