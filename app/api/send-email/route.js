// app/api/send-email/route.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { to, subject, html, type } = await req.json();

    if (!to || !subject) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: 'ThesisAlpha <alerts@thesisalpha.com>',
      to,
      subject,
      html: html || buildFallbackHTML(subject),
    });

    if (error) {
      console.error('[ThesisAlpha] Resend error:', error);
      return Response.json({ error: error.message || 'Send failed' }, { status: 500 });
    }

    return Response.json({ success: true, id: data.id });
  } catch (e) {
    console.error('[ThesisAlpha] Email route error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function buildFallbackHTML(subject) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#e5e7eb;background:#111113">
      <p style="color:#9ca3af;font-size:14px;line-height:1.6">${subject}</p>
      <hr style="border:none;border-top:1px solid #2a2a2e;margin:24px 0"/>
      <p style="font-size:11px;color:#6b7280">ThesisAlpha — invest with conviction, not impulse.</p>
    </div>`;
}
