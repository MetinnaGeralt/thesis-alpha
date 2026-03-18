// app/api/fetch-title/route.js
// Fetches the <title> tag from a URL server-side.
// Avoids CORS issues and keeps the client clean.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "No URL provided" }, { status: 400 });
  }

  // Only allow http/https
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Known domains where we can construct the title without fetching
  // (avoids 403s from sites that block scrapers)
  const shortcuts = [
    { test: /docs\.google\.com\/spreadsheets/,  title: (u) => "Google Sheets" },
    { test: /docs\.google\.com\/document/,      title: (u) => "Google Doc" },
    { test: /docs\.google\.com\/presentation/,  title: (u) => "Google Slides" },
    { test: /notion\.so|notion\.com/,           title: (u) => "Notion Page" },
    { test: /figma\.com/,                       title: (u) => "Figma File" },
    { test: /airtable\.com/,                    title: (u) => "Airtable Base" },
  ];

  for (const s of shortcuts) {
    if (s.test.test(url)) {
      return Response.json({ title: s.title(url) });
    }
  }

  // Fetch the page and extract <title>
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Appear as a browser to avoid bot blocks
        "User-Agent": "Mozilla/5.0 (compatible; ThesisAlpha/1.0)",
        "Accept": "text/html",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return Response.json({ title: null }, { status: 200 });
    }

    // Only read enough HTML to find the title tag (first 10KB)
    const reader = res.body.getReader();
    let html = "";
    let done = false;

    while (!done && html.length < 10000) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) html += new TextDecoder().decode(value);
      // Stop as soon as we have the title
      if (/<\/title>/i.test(html)) break;
    }

    // Cancel the rest of the stream
    reader.cancel().catch(() => {});

    // Extract title
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (match) {
      const title = match[1]
        .trim()
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        // Remove common suffixes like " | Company Name" or " - Site Name"
        .replace(/\s*[|\-–—]\s*.{3,40}$/, "")
        .trim();

      return Response.json({ title: title || null });
    }

    return Response.json({ title: null });
  } catch (e) {
    // Timeout, network error, etc — fail gracefully, don't surface to user
    return Response.json({ title: null }, { status: 200 });
  }
}

export async function POST() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
