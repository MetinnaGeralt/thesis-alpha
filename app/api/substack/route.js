// app/api/substack/route.js
export const dynamic = 'force-dynamic';

const FEED_URL = 'https://www.atomicmoatresearch.com/feed';
const CACHE_TTL = 3600; // 1 hour

let _cache = null;
let _cacheTime = 0;

// Article type detection from title
function detectType(title) {
  const t = title.toLowerCase();
  if (t.includes('deep dive')) return 'Deep Dive';
  if (t.includes('simple truth')) return 'Simple Truth';
  if (t.includes('titan test') || t.includes('titan tracker')) return 'Titan Test';
  if (t.includes('money mind')) return 'Money Mind';
  if (t.includes('radar') || t.includes('fins') || t.includes('earnings')) return 'The Radar';
  return 'Article';
}

// Extract ticker from title — look for ($TICKER) or $TICKER patterns
function extractTicker(title) {
  const m = title.match(/\(\$([A-Z]{1,5})\)|\$([A-Z]{1,5})\b/);
  if (m) return m[1] || m[2];
  // Also try "Company (TICKER)" pattern without dollar sign
  const m2 = title.match(/\(([A-Z]{2,5})\)/);
  if (m2 && !['CEO','CFO','IPO','ETF','USA','EUR','GDP'].includes(m2[1])) return m2[1];
  return null;
}

// Parse RSS XML manually (no external deps)
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
      const m = block.match(r);
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = get('title');
    const link = get('link') || block.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = get('pubDate');
    const description = get('description').replace(/<[^>]*>/g, '').substring(0, 200);
    if (title && link) {
      items.push({
        title,
        link: link.trim(),
        pubDate,
        description,
        type: detectType(title),
        ticker: extractTicker(title),
        date: pubDate ? new Date(pubDate).toISOString() : null,
      });
    }
  }
  return items;
}

export async function GET() {
  // Serve from cache if fresh
  if (_cache && (Date.now() - _cacheTime) < CACHE_TTL * 1000) {
    return Response.json(_cache);
  }
  try {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'ThesisAlpha/1.0' },
      next: { revalidate: CACHE_TTL }
    });
    if (!res.ok) throw new Error('RSS fetch failed: ' + res.status);
    const xml = await res.text();
    const articles = parseRSS(xml);
    _cache = { articles, fetchedAt: new Date().toISOString() };
    _cacheTime = Date.now();
    return Response.json(_cache);
  } catch (e) {
    console.error('[substack]', e);
    // Return stale cache if available
    if (_cache) return Response.json(_cache);
    return Response.json({ articles: [], fetchedAt: null, error: e.message });
  }
}
