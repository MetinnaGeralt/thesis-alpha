import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const key = process.env.FINNHUB_KEY;
  if (!key) return NextResponse.json({ error: "FINNHUB_KEY not set" }, { status: 500 });

  try {
    const sep = endpoint.includes("?") ? "&" : "?";
    const url = `https://finnhub.io/api/v1/${endpoint}${sep}token=${key}`;
    const res = await fetch(url, { next: { revalidate: 300 } }); // cache 5min
    if (!res.ok) return NextResponse.json({ error: "Finnhub " + res.status }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
