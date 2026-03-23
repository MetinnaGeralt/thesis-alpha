// app/api/ai/route.js
// Proxy for all Anthropic API calls from ThesisAlpha.
// Enforces: auth check, Pro-only, per-user daily rate limit, monthly spend cap, dedup guard.

import { createClient } from "@supabase/supabase-js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role for server-side

// ── Spending cap ──────────────────────────────────────────────────────────────
// Hard monthly limit in USD. When hit, all AI calls return 402 until next month.
// Set ANTHROPIC_MONTHLY_CAP in your Vercel env vars (e.g. "30" for $30/month).
// ALSO set a matching budget cap in your Anthropic dashboard:
// https://console.anthropic.com/settings/limits
const MONTHLY_CAP_USD = parseFloat(process.env.ANTHROPIC_MONTHLY_CAP || "30");

// Approximate cost per call type (USD). Conservative estimates.
// claude-sonnet-4: ~$3 per 1M input tokens, ~$15 per 1M output tokens
const COST_PER_CALL = {
  digest:  0.003,  // AI conviction digest — ~150 out tokens
  letter:  0.025,  // Owner's Letter — ~1400 out tokens
  journal: 0.004,  // Journal narrative — ~200 out tokens
  ramble:  0.003,  // Clean up ramble — ~150 out tokens
  import:  0.025,  // Analysis import — large input + structured JSON output
  default: 0.010,
};

// ── Per-user daily rate limits ─────────────────────────────────────────────────
const DAILY_LIMIT_PER_USER = {
  digest:  7,   // max once per review, reviews are weekly
  letter:  1,   // 1 per quarter — no manual generation
  journal: 14,  // once per review + a few manual
  ramble:  20,  // most frequent — cleanup calls
  import:  5,   // 5 analysis imports per day is plenty
  default: 10,
};

// ── In-memory dedup store ─────────────────────────────────────────────────────
// Prevents the "loop" problem: same prompt fired multiple times within 10s.
// Uses a Map keyed by userId+promptHash, expires after DEDUP_WINDOW_MS.
const inflightRequests = new Map();
const DEDUP_WINDOW_MS = 10_000; // 10 seconds

function hashPrompt(str) {
  // Simple djb2 hash — fast, good enough for dedup
  let hash = 5381;
  for (let i = 0; i < Math.min(str.length, 500); i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit int
  }
  return hash.toString(36);
}

// ── Spend tracking (in-memory + Supabase) ─────────────────────────────────────
// In-memory for speed. Supabase as persistent backup across deploys/instances.
const monthlySpend = { month: "", total: 0 };

async function getMonthlySpend(supabase) {
  const month = new Date().toISOString().slice(0, 7); // "2026-03"
  if (monthlySpend.month !== month) {
    // New month — reset in-memory, fetch from Supabase
    monthlySpend.month = month;
    monthlySpend.total = 0;
    try {
      const { data } = await supabase
        .from("ai_spend")
        .select("total_usd")
        .eq("month", month)
        .single();
      if (data) monthlySpend.total = data.total_usd || 0;
    } catch (e) {
      // Table may not exist yet — will be created on first write
    }
  }
  return monthlySpend.total;
}

async function recordSpend(supabase, costUsd) {
  monthlySpend.total += costUsd;
  const month = monthlySpend.month;
  try {
    await supabase.from("ai_spend").upsert(
      { month, total_usd: monthlySpend.total, updated_at: new Date().toISOString() },
      { onConflict: "month" }
    );
  } catch (e) {
    console.warn("ai_spend upsert failed:", e.message);
  }
}

// ── Daily per-user call counter ───────────────────────────────────────────────
const userCallCounts = new Map(); // key: "userId:callType:date"

function getUserCallKey(userId, callType) {
  const date = new Date().toISOString().slice(0, 10); // "2026-03-18"
  return `${userId}:${callType}:${date}`;
}

function checkAndIncrementUserLimit(userId, callType) {
  const key = getUserCallKey(userId, callType);
  const limit = DAILY_LIMIT_PER_USER[callType] || DAILY_LIMIT_PER_USER.default;
  const current = userCallCounts.get(key) || 0;
  if (current >= limit) return false;
  userCallCounts.set(key, current + 1);
  // Clean up old keys every 1000 entries
  if (userCallCounts.size > 1000) {
    const today = new Date().toISOString().slice(0, 10);
    for (const [k] of userCallCounts) {
      if (!k.includes(today)) userCallCounts.delete(k);
    }
  }
  return true;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  // 1. Check API key is configured
  if (!ANTHROPIC_API_KEY) {
    return Response.json({ error: "AI features not configured." }, { status: 503 });
  }

  // 2. Validate auth — require Supabase JWT
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  // Create Supabase client with service role for server-side validation
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: "Invalid session." }, { status: 401 });
  }

  const userId = user.id;
  const userEmail = user.email;

  // 3. Pro-only check (owner email always passes)
  const OWNER_EMAIL = "leypoldtcapital@gmail.com";
  const isOwner = userEmail === OWNER_EMAIL;

  if (!isOwner) {
    // Check plan from Supabase profile
    try {
      const { data: profile } = await supabase
        .from("portfolios")
        .select("data")
        .eq("user_id", userId)
        .single();
      const plan = profile?.data?.plan || "free";
      const trial = profile?.data?.trial;
      const trialActive = trial?.start && 
        Math.ceil((Date.now() - new Date(trial.start).getTime()) / 86400000) <= (trial.totalDays || 14);
      
      if (plan !== "pro" && !trialActive) {
        return Response.json({ error: "Pro subscription required." }, { status: 403 });
      }
    } catch (e) {
      return Response.json({ error: "Could not verify subscription." }, { status: 403 });
    }
  }

  // 4. Parse request body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { messages, model, max_tokens, callType = "default" } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages provided." }, { status: 400 });
  }

  // 5. Dedup guard — prevent loop/double-fire
  const promptHash = hashPrompt(JSON.stringify(messages));
  const dedupKey = `${userId}:${promptHash}`;
  const now = Date.now();
  const lastCall = inflightRequests.get(dedupKey);
  if (lastCall && (now - lastCall) < DEDUP_WINDOW_MS) {
    console.log(`Dedup blocked for user ${userId}, callType ${callType}`);
    return Response.json(
      { error: "Duplicate request blocked. Please wait a moment." },
      { status: 429 }
    );
  }
  inflightRequests.set(dedupKey, now);
  // Clean up old dedup entries
  if (inflightRequests.size > 500) {
    for (const [k, v] of inflightRequests) {
      if (now - v > DEDUP_WINDOW_MS * 3) inflightRequests.delete(k);
    }
  }

  // 6. Per-user daily rate limit
  if (!isOwner && !checkAndIncrementUserLimit(userId, callType)) {
    return Response.json(
      { error: `Daily limit reached for this feature. Try again tomorrow.` },
      { status: 429 }
    );
  }

  // 7. Monthly spend cap
  const currentSpend = await getMonthlySpend(supabase);
  if (currentSpend >= MONTHLY_CAP_USD) {
    console.warn(`Monthly AI spend cap hit: $${currentSpend.toFixed(2)} / $${MONTHLY_CAP_USD}`);
    return Response.json(
      { error: "Monthly AI budget reached. Resets on the 1st." },
      { status: 402 }
    );
  }

  // 8. Forward to Anthropic
  let anthropicResponse;
  try {
    anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: Math.min(max_tokens || 1400, 1400), // hard cap at 1400 for letter support
        messages,
      }),
    });
  } catch (e) {
    return Response.json({ error: "AI service unavailable." }, { status: 503 });
  }

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text();
    console.error("Anthropic error:", anthropicResponse.status, errText);
    return Response.json({ error: "AI request failed." }, { status: 502 });
  }

  const data = await anthropicResponse.json();

  // 9. Record spend (async — don't block response)
  const costUsd = COST_PER_CALL[callType] || COST_PER_CALL.default;
  recordSpend(supabase, costUsd).catch(console.warn);

  return Response.json(data);
}

// Block all non-POST methods
export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}
