export async function GET() {
  const key = process.env.FMP_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const results = {
    fmp_key_set: !!key,
    fmp_key_preview: key ? key.substring(0, 6) + "..." : "MISSING",
    anthropic_key_set: !!anthropicKey,
    anthropic_key_preview: anthropicKey ? anthropicKey.substring(0, 10) + "..." : "MISSING",
    supabase_url_set: !!supaUrl,
    tests: {}
  };

  if (key) {
    const endpoints = [
      ["profile", "profile?symbol=AAPL"],
      ["quote", "quote?symbol=GRMN"],
      ["income-statement", "income-statement?symbol=GRMN&period=quarter&limit=1"],
      ["key-metrics", "key-metrics?symbol=GRMN&period=quarter&limit=1"],
    ];

    for (const [name, ep] of endpoints) {
      try {
        const res = await fetch(`https://financialmodelingprep.com/stable/${ep}&apikey=${key}`);
        const data = await res.json();
        if (data && data["Error Message"]) {
          results.tests[name] = "PAID-ONLY: " + data["Error Message"].substring(0, 100);
        } else if (data && data.length) {
          const sample = JSON.stringify(data[0]).substring(0, 150);
          results.tests[name] = "OK (" + data.length + " results) " + sample;
        } else {
          results.tests[name] = "EMPTY: " + JSON.stringify(data).substring(0, 150);
        }
      } catch (e) {
        results.tests[name] = "FAILED: " + e.message;
      }
    }
  }

  return Response.json(results, { headers: { "Content-Type": "application/json" } });
}
