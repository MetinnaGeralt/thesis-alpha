// app/api/fmp-test/route.js — Diagnostic endpoint to debug FMP calls
// Visit: /api/fmp-test?ticker=DUOL to see what happens
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker') || 'AAPL';
  const key = process.env.FMP_KEY;

  const results = {
    ticker,
    hasKey: !!key,
    keyPrefix: key ? key.substring(0, 6) + '...' : 'MISSING',
    timestamp: new Date().toISOString(),
    tests: []
  };

  if (!key) {
    results.error = 'FMP_KEY environment variable is not set';
    return Response.json(results, { status: 500 });
  }

  // Test 1: Stable API - income statement
  const urls = [
    {
      label: 'stable/income-statement',
      url: `https://financialmodelingprep.com/stable/income-statement?symbol=${ticker}&period=annual&limit=3&apikey=${key}`
    },
    {
      label: 'v3/income-statement',
      url: `https://financialmodelingprep.com/api/v3/income-statement/${ticker}?period=annual&limit=3&apikey=${key}`
    },
    {
      label: 'stable/profile',
      url: `https://financialmodelingprep.com/stable/profile?symbol=${ticker}&apikey=${key}`
    },
    {
      label: 'v3/profile',
      url: `https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${key}`
    },
    {
      label: 'stable/balance-sheet-statement',
      url: `https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=${ticker}&period=annual&limit=3&apikey=${key}`
    },
    {
      label: 'v3/balance-sheet-statement',
      url: `https://financialmodelingprep.com/api/v3/balance-sheet-statement/${ticker}?period=annual&limit=3&apikey=${key}`
    }
  ];

  for (const test of urls) {
    const result = { label: test.label, url: test.url.replace(key, 'KEY') };
    try {
      const res = await fetch(test.url, {
        headers: { 'User-Agent': 'ThesisAlpha/1.0' }
      });
      result.status = res.status;
      result.statusText = res.statusText;
      result.headers = Object.fromEntries(res.headers.entries());
      
      const text = await res.text();
      result.rawLength = text.length;
      result.rawPreview = text.substring(0, 500);
      
      try {
        const json = JSON.parse(text);
        result.isArray = Array.isArray(json);
        result.arrayLength = Array.isArray(json) ? json.length : null;
        result.hasError = !!(json && json['Error Message']);
        result.errorMessage = json && json['Error Message'] ? json['Error Message'] : null;
        if (Array.isArray(json) && json.length > 0) {
          result.firstItemKeys = Object.keys(json[0]).slice(0, 15);
          result.firstItemSample = {};
          Object.keys(json[0]).slice(0, 5).forEach(k => {
            result.firstItemSample[k] = json[0][k];
          });
        }
      } catch (e) {
        result.jsonParseError = e.message;
      }
    } catch (e) {
      result.fetchError = e.message;
    }
    results.tests.push(result);
  }

  return Response.json(results, {
    headers: { 'Content-Type': 'application/json' }
  });
}
