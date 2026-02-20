export async function POST(request) {
  const body = await request.json();
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return Response.json({ error: "ANTHROPIC_API_KEY not set in environment variables" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    // If web search tool caused an error, retry without it
    if (data.error && body.tools && body.tools.length > 0) {
      const bodyNoTools = { ...body };
      delete bodyNoTools.tools;
      const res2 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(bodyNoTools)
      });
      return Response.json(await res2.json());
    }

    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
