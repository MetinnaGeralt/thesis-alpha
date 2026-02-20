export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) return Response.json({ error: "No endpoint" }, { status: 400 });

  const key = process.env.FMP_KEY;
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `https://financialmodelingprep.com/stable/${endpoint}${sep}apikey=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return Response.json(null);
    const data = await res.json();
    if (data && data["Error Message"]) return Response.json(null);
    return Response.json(data);
  } catch (e) {
    return Response.json(null);
  }
}
