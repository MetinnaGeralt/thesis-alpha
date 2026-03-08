// app/api/cron/weekly-reminder/route.js
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all user portfolios from Supabase
    const { data: portfolios, error } = await supabase
      .from('portfolios')
      .select('user_id, data');

    if (error || !portfolios) {
      console.error('[Cron] Supabase error:', error);
      return Response.json({ error: 'Failed to fetch portfolios' }, { status: 500 });
    }

    // Get user emails from auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('[Cron] Auth error:', authError);
      return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const userMap = {};
    (users || []).forEach(u => { userMap[u.id] = u.email; });

    let sent = 0;
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const portfolio of portfolios) {
      const email = userMap[portfolio.user_id];
      if (!email || !portfolio.data || !portfolio.data.cos) continue;

      const cos = portfolio.data.cos;
      const profile = portfolio.data.profile || {};
      const weeklyReviews = profile.weeklyReviews || [];
      const streak = profile.streak || {};
      const username = profile.username || '';

      // Only email active users (at least 1 company with a thesis)
      const holdings = cos.filter(c => (c.status || 'portfolio') === 'portfolio');
      const withThesis = holdings.filter(c => c.thesisNote && c.thesisNote.trim().length > 20);
      if (holdings.length === 0 || withThesis.length === 0) continue;

      // Find upcoming earnings this week
      const upcoming = holdings.filter(c => {
        if (!c.earningsDate || c.earningsDate === 'TBD') return false;
        const diff = Math.ceil((new Date(c.earningsDate) - now) / 86400000);
        return diff >= 0 && diff <= 7;
      });

      // Check if weekly review is done
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
      const weekId = weekStart.toISOString().split('T')[0];
      const reviewDone = weeklyReviews.length > 0 && weeklyReviews[0].weekId === weekId;

      // KPI results pending check
      const pendingKpis = holdings.filter(c => {
        if (!c.earningsDate || c.earningsDate === 'TBD') return false;
        const diff = Math.ceil((new Date(c.earningsDate) - now) / 86400000);
        return diff <= 0 && diff > -7 && c.kpis.length > 0 && !c.kpis.some(k => k.lastResult);
      });

      // Don't send if nothing to say
      if (upcoming.length === 0 && reviewDone && pendingKpis.length === 0) continue;

      // Build email
      const greeting = username || 'Investor';
      const streakWeeks = streak.current || 0;

      let body = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#e5e7eb;background:#111113">`;
      body += `<div style="font-size:13px;font-weight:700;color:#6366F1;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">ThesisAlpha</div>`;
      body += `<div style="font-size:20px;font-weight:600;color:#e5e7eb;margin-bottom:4px">Weekly Update</div>`;
      body += `<div style="font-size:13px;color:#9ca3af;margin-bottom:24px">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>`;
      body += `<div style="font-size:14px;color:#e5e7eb;line-height:1.7;margin-bottom:20px">Hi ${greeting},</div>`;

      // Upcoming earnings
      if (upcoming.length > 0) {
        body += `<div style="background:#18181b;border:1px solid #2a2a2e;border-radius:8px;padding:16px 20px;margin-bottom:16px">`;
        body += `<div style="font-size:11px;font-weight:600;color:#f59e0b;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Earnings This Week</div>`;
        upcoming.forEach(c => {
          const kpiCount = c.kpis ? c.kpis.length : 0;
          body += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #2a2a2e">`;
          body += `<span style="font-size:13px;font-weight:600;color:#e5e7eb">${c.ticker}</span>`;
          body += `<span style="font-size:11px;color:#9ca3af">${c.name || ''}</span>`;
          body += `<span style="font-size:11px;color:#f59e0b;margin-left:auto">${c.earningsDate} ${c.earningsTime || ''}</span>`;
          if (kpiCount > 0) body += `<span style="font-size:10px;color:#3b82f6">${kpiCount} KPIs ready</span>`;
          body += `</div>`;
        });
        body += `</div>`;
      }

      // Pending KPI checks
      if (pendingKpis.length > 0) {
        body += `<div style="background:#18181b;border:1px solid #2a2a2e;border-radius:8px;padding:16px 20px;margin-bottom:16px">`;
        body += `<div style="font-size:11px;font-weight:600;color:#3b82f6;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">KPI Check Needed</div>`;
        body += `<div style="font-size:13px;color:#e5e7eb">${pendingKpis.map(c => c.ticker).join(', ')} — earnings released, KPIs not yet checked.</div>`;
        body += `</div>`;
      }

      // Weekly review reminder
      if (!reviewDone) {
        body += `<div style="background:#18181b;border:1px solid #2a2a2e;border-radius:8px;padding:16px 20px;margin-bottom:16px">`;
        body += `<div style="font-size:11px;font-weight:600;color:#22c55e;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Weekly Review Due</div>`;
        body += `<div style="font-size:13px;color:#e5e7eb">`;
        if (streakWeeks > 0) {
          body += `You're on a <strong style="color:#22c55e">${streakWeeks}-week streak</strong>. Don't break it — your weekly review takes 3 minutes.`;
        } else {
          body += `Start your first weekly review to build a streak. 3 minutes to confirm conviction across ${holdings.length} holding${holdings.length !== 1 ? 's' : ''}.`;
        }
        body += `</div></div>`;
      }

      // CTA
      body += `<div style="margin-top:24px;text-align:center"><a href="https://thesisalpha.io" style="display:inline-block;background:#6366F1;color:#fff;text-decoration:none;padding:10px 28px;border-radius:6px;font-size:13px;font-weight:600">Open ThesisAlpha</a></div>`;
      body += `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #2a2a2e;text-align:center">`;
      body += `<div style="font-size:11px;color:#4b5563">ThesisAlpha — invest with conviction, not impulse.</div>`;
      body += `</div></div>`;

      // Send
      const subject = upcoming.length > 0
        ? `ThesisAlpha: ${upcoming.map(c => c.ticker).join(', ')} report${upcoming.length > 1 ? '' : 's'} this week`
        : !reviewDone && streakWeeks > 0
          ? `ThesisAlpha: ${streakWeeks}-week streak on the line`
          : `ThesisAlpha: Your weekly update`;

      try {
        await resend.emails.send({
          from: 'ThesisAlpha <alerts@thesisalpha.io>',
          to: email,
          subject,
          html: body,
        });
        sent++;
      } catch (e) {
        console.error(`[Cron] Failed to send to ${email}:`, e.message);
      }

      // Rate limit: 100ms between sends
      await new Promise(r => setTimeout(r, 100));
    }

    return Response.json({ success: true, sent, total: portfolios.length });
  } catch (e) {
    console.error('[Cron] Error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
