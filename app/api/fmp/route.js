// app/api/fmp/route.js — Handles FMP stable + v3 + v4 API formats
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const key = process.env.FMP_KEY;

  if (!endpoint || !key) {
    return Response.json({ error: 'Missing endpoint or API key' }, { status: 400 });
  }

  const separator = endpoint.includes('?') ? '&' : '?';

  // Build URLs to try — stable first (recommended by FMP), then v3, then v4
  const urls = [];

  // 1. Stable API format (PREFERRED): /stable/income-statement?symbol=AAPL&period=annual
  const stableUrl = buildStableUrl(endpoint, key);
  if (stableUrl) urls.push(stableUrl);

  // 2. Standard v3 format: /api/v3/income-statement/AAPL?period=annual
  urls.push(`https://financialmodelingprep.com/api/v3/${endpoint}${separator}apikey=${key}`);

  // 3. v4 format for some endpoints
  urls.push(`https://financialmodelingprep.com/api/v4/${endpoint}${separator}apikey=${key}`);

  let lastError = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ThesisAlpha/1.0' },
        next: { revalidate: 300 }
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.log(`[FMP] ${res.status} for ${url.replace(key, 'KEY')} — ${text.substring(0, 200)}`);
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();

      // Check for FMP error responses
      if (data && data['Error Message']) {
        console.log(`[FMP] Error: ${data['Error Message']} for ${url.replace(key, 'KEY')}`);
        lastError = data['Error Message'];
        continue;
      }

      // Check for _fmpError-style responses from nested calls
      if (data && data._fmpError) {
        lastError = data.reason;
        continue;
      }

      // Skip empty arrays (wrong endpoint/tier)
      if (Array.isArray(data) && data.length === 0) {
        console.log(`[FMP] Empty array for ${url.replace(key, 'KEY')}`);
        lastError = 'empty';
        continue;
      }

      // Valid data found
      if (data !== null && data !== undefined) {
        return Response.json(data);
      }
    } catch (e) {
      console.warn(`[FMP] Fetch error for ${url.replace(key, 'KEY')}:`, e.message);
      lastError = e.message;
      continue;
    }
  }

  // All URLs failed — return diagnostic info
  console.log(`[FMP] All URLs failed for endpoint: ${endpoint} (last: ${lastError})`);
  return Response.json({ _fmpError: true, reason: lastError || 'all_failed', endpoint });
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

    // Single segment endpoints
    if (pathSegments.length === 1) {
      return `https://financialmodelingprep.com/stable/${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${key}`;
    }

    return null;
  } catch (e) {
    return null;
  }
}
