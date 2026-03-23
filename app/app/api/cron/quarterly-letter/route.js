// app/api/cron/quarterly-letter/route.js
//
// Runs on the 1st of Jan, Apr, Jul, Oct at 08:00 UTC.
// For every Pro subscriber who has enough portfolio data,
// generates a personalised quarterly Owner's Letter via Claude Sonnet,
// saves it to their Supabase portfolio record, and sends it by email.
//
// Vercel cron schedule: "0 8 1 1,4,7,10 *"
// Cost: ~$0.025 per user per quarter — negligible at any realistic scale.


import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';


const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Helpers ────────────────────────────────────────────────────────────────────

function getQuarter(date = new Date()) {
  const q = Math.ceil((date.getMonth() + 1) / 3);
  return { q, year: date.getFullYear(), label: `Q${q} ${date.getFullYear()}` };
}

function buildPrompt(cos, quarter, myStrategy, ownersLetterHistory) {
  const portf = cos.filter(c => (c.status || 'portfolio') === 'portfolio');
  if (portf.length === 0) return null;

  const holdingLines = portf.map(c => {
    const pos = c.position || {};
    const ret = pos.avgCost && pos.currentPrice
      ? (((pos.currentPrice - pos.avgCost) / pos.avgCost) * 100).toFixed(1) + '%'
      : 'unknown';
    const thesis = c.thesisNote ? c.thesisNote.substring(0, 180) : 'no thesis written';
    const kpiStr = (c.kpis || []).length > 0
      ? 'KPIs: ' + (c.kpis || []).slice(0, 3).map(k =>
          k.label + (k.lastResult != null ? ` (${k.lastResult})` : '')).join(', ')
      : 'no KPIs set';
    const conv = c.conviction || 5;
    const ch = (c.convictionHistory || []).slice(-8);
    let convDir = 'stable';
    if (ch.length >= 4) {
      const d = ch[ch.length - 1].rating - ch[0].rating;
      if (d >= 2) convDir = `BUILDING +${d} pts`;
      else if (d <= -2) convDir = `DRIFTING ${d} pts`;
    }
    const thesisDays = c.thesisUpdatedAt
      ? Math.floor((Date.now() - new Date(c.thesisUpdatedAt).getTime()) / 86400000)
      : null;
    const stale = thesisDays !== null && thesisDays > 90
      ? ` (STALE: ${thesisDays}d since update)` : '';
    const recentDecs = (c.decisions || [])
      .filter(d => d.date && new Date(d.date) > new Date(Date.now() - 90 * 86400000))
      .map(d => d.action + (d.reasoning ? ` '${d.reasoning.substring(0, 60)}'` : '') + (d.outcome ? ` [${d.outcome}]` : ''))
      .join('; ') || 'none';
    return `- ${c.ticker} (${c.name}): conviction ${conv}/10 [${convDir}], return ${ret}${stale}. ${kpiStr}. Thesis: ${thesis}. Recent decisions: ${recentDecs}`;
  }).join('\n');

  const allDecs = [];
  portf.forEach(c => {
    (c.decisions || []).slice(0, 3).forEach(d => {
      if (d.date && new Date(d.date) > new Date(Date.now() - 90 * 86400000)) {
        allDecs.push(
          `${(d.date || '').substring(0, 10)} ${d.action} ${c.ticker}` +
          (d.price ? ` @ $${d.price}` : '') +
          (d.reasoning ? ` — '${d.reasoning.substring(0, 80)}'` : '') +
          (d.outcome ? ` [${d.outcome}]` : '')
        );
      }
    });
  });

  const letterHistory = (ownersLetterHistory || []).slice(0, 3)
    .map((l, i) => `Letter ${i} quarters ago: ${l.summary}`).join('\n');

  let stratStr = '';
  if (myStrategy && (myStrategy.whatIInvestIn || myStrategy.howIBehave || myStrategy.whatIAvoid)) {
    stratStr = '\n\nInvestor strategy:\n' +
      (myStrategy.whatIInvestIn ? `Invests in: ${myStrategy.whatIInvestIn.substring(0, 200)}\n` : '') +
      (myStrategy.howIBehave ? `Behaves: ${myStrategy.howIBehave.substring(0, 200)}\n` : '') +
      (myStrategy.whatIAvoid ? `Avoids: ${myStrategy.whatIAvoid.substring(0, 200)}\n` : '');
  }

  return `You are writing the Owner's Letter — a private quarterly letter delivered to a long-term investor by their portfolio. The voice is warm, direct, conversational — like a trusted partner who has been quietly watching. Plain-spoken, specific, occasionally dry. Use 'I' (the portfolio speaking). Reference tickers and real numbers. Never generic.

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "letter": "5 paragraphs separated by \\n\\n. Open with something specific. Name one behaviour done well. Name one thing worth a second look. Forward look. Close with a single hard question.",
  "closingQuote": "1-2 motivational sentences, written like a great investor, tailored to what happened this quarter — original, not a real quote.",
  "closingQuoteAttr": "Tailored for your quarter · ${quarter.label}",
  "whatWorked": {"title": "short title", "desc": "2 sentences, specific, warm"},
  "whatWorked2": {"title": "short title", "desc": "2 sentences"},
  "needsAttention": {"title": "short title", "desc": "2 sentences, honest"},
  "needsAttention2": {"title": "short title", "desc": "2 sentences"},
  "lesson": "2-3 sentences on a long-term investing principle from this quarter",
  "watchItem": {"title": "what to watch next quarter", "desc": "2 sentences"},
  "closingQuestion": "The hard question to carry into next quarter."
}

Quarter: ${quarter.label}
Portfolio:
${holdingLines}

Decisions (last 90 days):
${allDecs.length > 0 ? allDecs.join('\n') : 'None logged this quarter.'}
${letterHistory ? `\nPrevious letters (don't repeat themes):\n${letterHistory}` : ''}${stratStr}

Now write the letter.`;
}

function buildEmailHtml(letter, portf) {
  const tickers = portf.map(c => c.ticker).join(' · ');
  const F = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  const paras = (letter.text || '').split('\n\n').filter(p => p.trim());
  const mainParas = paras.slice(0, 2).concat(paras.slice(3));
  const calloutPara = paras[2] || '';
  const dateStr = new Date(letter.date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  let body = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EB;padding:32px 0">
    <tr><td align="center" style="padding:0 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
    <tr><td style="background:#FAF9F6;border:1px solid rgba(26,26,26,0.1);border-radius:12px;padding:48px 52px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1.5px solid #1a1a1a;padding-bottom:18px;margin-bottom:24px">
        <tr>
          <td>
            <div style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:4px">Private · Quarterly · Pro</div>
            <div style="font-family:Georgia,serif;font-size:22px;color:#1a1a1a">The Owner's Letter</div>
          </td>
          <td align="right" valign="top">
            <div style="font-family:monospace;font-size:10px;color:#888;letter-spacing:1px">${letter.quarter}</div>
            <div style="font-family:${F};font-size:12px;color:#888;margin-top:3px">${dateStr}</div>
          </td>
        </tr>
      </table>
      <div style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:28px">From your portfolio · to you</div>`;

  mainParas.forEach((p, i) => {
    if (i === 0) {
      // Drop cap first paragraph
      body += `<p style="font-family:Georgia,serif;font-size:15px;line-height:1.9;color:#1a1a1a;margin:0 0 20px">${p}</p>`;
    } else {
      body += `<p style="font-family:Georgia,serif;font-size:14.5px;line-height:1.9;color:#1a1a1a;margin:0 0 20px">${p}</p>`;
    }
  });

  if (calloutPara) {
    body += `<div style="border-left:2px solid #1a1a1a;padding:12px 18px;margin:24px 0;background:rgba(26,26,26,0.04)">
      <p style="font-family:Georgia,serif;font-size:14px;line-height:1.8;color:#555;font-style:italic;margin:0">${calloutPara}</p>
    </div>`;
  }

  if (letter.closingQuote) {
    body += `<div style="border:1px solid rgba(26,26,26,0.12);padding:22px 26px;text-align:center;margin:28px 0;background:#F5F2EB;border-radius:6px">
      <div style="font-family:monospace;font-size:9px;width:28px;height:1px;background:#1a1a1a;margin:0 auto 16px"></div>
      <p style="font-family:Georgia,serif;font-size:15px;line-height:1.85;color:#1a1a1a;font-style:italic;margin:0 0 12px">&#8220;${letter.closingQuote}&#8221;</p>
      <p style="font-family:monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin:0">${letter.closingQuoteAttr || ''}</p>
    </div>`;
  }

  if (letter.closingQuestion) {
    body += `<div style="border-top:1px solid rgba(26,26,26,0.12);padding-top:22px;margin-top:4px">
      <div style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:10px">Carry into next quarter</div>
      <p style="font-family:Georgia,serif;font-size:15px;color:#1a1a1a;line-height:1.8;font-style:italic;margin:0">&#8220;${letter.closingQuestion}&#8221;</p>
    </div>`;
  }

  body += `<div style="margin-top:32px;padding-top:18px;border-top:1px solid rgba(26,26,26,0.1)">
    <div style="font-family:${F};font-size:13px;color:#888;margin-bottom:5px">— Your Portfolio</div>
    <div style="font-family:monospace;font-size:11px;color:#aaa;letter-spacing:1px">${tickers}</div>
  </div>

  <div style="margin-top:28px;text-align:center">
    <a href="https://thesisalpha.io" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 28px;border-radius:6px;font-family:${F};font-size:12px;font-weight:600;letter-spacing:0.5px">Read the full letter in ThesisAlpha →</a>
  </div>

  </td></tr>
  <tr><td style="padding:16px 0;text-align:center">
    <p style="font-family:${F};font-size:11px;color:#999;margin:0">ThesisAlpha · Private · Quarterly · Pro</p>
    <p style="font-family:${F};font-size:10px;color:#bbb;margin:4px 0 0">Not financial advice. Personal use only.</p>
  </td></tr>
  </table></td></tr></table>`;

  return body;
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(request) {
  // 1. Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const quarter = getQuarter();
  console.log(`[Quarterly Letter] Starting generation for ${quarter.label}`);

  try {
    // 2. Fetch all portfolios
    const { data: portfolios, error: dbError } = await supabase
      .from('portfolios')
      .select('user_id, data');

    if (dbError || !portfolios) {
      console.error('[Quarterly Letter] Supabase error:', dbError);
      return Response.json({ error: 'Failed to fetch portfolios' }, { status: 500 });
    }

    // 3. Fetch user emails
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('[Quarterly Letter] Auth error:', authError);
      return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
    const userMap = {};
    (users || []).forEach(u => { userMap[u.id] = u.email; });

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const portfolio of portfolios) {
      const email = userMap[portfolio.user_id];
      if (!email || !portfolio.data) { skipped++; continue; }

      const data = portfolio.data;
      const cos = data.cos || [];
      const plan = data.plan || 'free';

      // 4. Pro-only — skip free users and trials
      if (plan !== 'pro') { skipped++; continue; }

      // 5. Enough data to write something real
      const portf = cos.filter(c => (c.status || 'portfolio') === 'portfolio');
      const thesesWritten = portf.filter(c => c.thesisNote && c.thesisNote.trim().length > 50).length;
      const decisionsLogged = portf.reduce((s, c) => s + (c.decisions || []).length, 0);
      if (portf.length === 0 || thesesWritten < 1) { skipped++; continue; }

      // 6. Don't regenerate if letter for this quarter already exists
      const existingLetters = data.ownersLetters || [];
      const alreadyExists = existingLetters.some(l => l.quarter === quarter.label);
      if (alreadyExists) { skipped++; continue; }

      // 7. Build prompt
      const prompt = buildPrompt(cos, quarter, data.myStrategy, existingLetters);
      if (!prompt) { skipped++; continue; }

      try {
        // 8. Generate letter via Claude Sonnet
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1400,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!anthropicRes.ok) { failed++; continue; }
        const anthropicData = await anthropicRes.json();

        const raw = anthropicData.content?.[0]?.text || '';
        if (!raw) { failed++; continue; }

        // 9. Parse structured JSON response
        let parsed;
        try {
          const clean = raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
          parsed = JSON.parse(clean);
        } catch (e) {
          // Fallback — treat raw text as the letter prose
          parsed = {
            letter: raw,
            closingQuote: 'The best investment decisions are the ones you can explain clearly — because clarity of thought and clarity of action are the same thing.',
            closingQuoteAttr: `Tailored for your quarter · ${quarter.label}`,
            whatWorked: { title: 'You stayed consistent', desc: 'Your portfolio tracked through the quarter without disruption.' },
            whatWorked2: { title: 'You logged your thinking', desc: 'Decisions and conviction changes were recorded.' },
            needsAttention: { title: 'Keep updating theses', desc: 'A thesis that isn\'t updated is a thesis you don\'t trust anymore.' },
            needsAttention2: { title: 'Build your KPI set', desc: 'KPIs are the scorecard you write when you\'re calm, for the moments when you aren\'t.' },
            lesson: 'Long-term investing is mostly about what you don\'t do. This quarter was a reminder of that.',
            watchItem: { title: 'Update before next earnings', desc: 'Review each thesis before the next reporting cycle begins.' },
            closingQuestion: 'Which of your holdings would you be most uncomfortable explaining to a knowledgeable friend — and why?',
          };
          parsed.letter = raw;
        }

        const summary = (parsed.letter || '').split('.')[0].substring(0, 120);
        const letter = {
          id: Date.now(),
          date: new Date().toISOString(),
          month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
          quarter: quarter.label,
          qNum: quarter.q,
          year: quarter.year,
          text: parsed.letter || raw,
          closingQuote: parsed.closingQuote || '',
          closingQuoteAttr: parsed.closingQuoteAttr || `Tailored for your quarter · ${quarter.label}`,
          whatWorked: parsed.whatWorked || {},
          whatWorked2: parsed.whatWorked2 || {},
          needsAttention: parsed.needsAttention || {},
          needsAttention2: parsed.needsAttention2 || {},
          lesson: parsed.lesson || '',
          watchItem: parsed.watchItem || {},
          closingQuestion: parsed.closingQuestion || '',
          summary,
          holdings: portf.length,
        };

        // 10. Save letter to Supabase
        const updatedLetters = [letter, ...existingLetters].slice(0, 12); // keep last 3 years
        await supabase
          .from('portfolios')
          .update({ data: { ...data, ownersLetters: updatedLetters } })
          .eq('user_id', portfolio.user_id);

        // 11. Send email
        const emailHtml = buildEmailHtml(letter, portf);
        await resend.emails.send({
          from: 'ThesisAlpha <letters@thesisalpha.io>',
          to: email,
          subject: `Your ${quarter.label} Owner's Letter — ThesisAlpha`,
          html: emailHtml,
        });

        generated++;
        console.log(`[Quarterly Letter] Generated + sent for ${email} (${quarter.label})`);

        // Rate limit: 300ms between users (Anthropic + Resend courtesy)
        await new Promise(r => setTimeout(r, 300));

      } catch (e) {
        console.error(`[Quarterly Letter] Failed for ${email}:`, e.message);
        failed++;
      }
    }

    console.log(`[Quarterly Letter] Done — generated: ${generated}, skipped: ${skipped}, failed: ${failed}`);
    return Response.json({ success: true, quarter: quarter.label, generated, skipped, failed });

  } catch (e) {
    console.error('[Quarterly Letter] Fatal error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
