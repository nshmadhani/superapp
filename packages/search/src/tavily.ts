export type SearchHit = { title: string; url: string; content: string };

export async function webSearch(
  query: string,
  apiKey = process.env.TAVILY_API_KEY,
): Promise<SearchHit[]> {
  if (!apiKey) throw new Error("Missing TAVILY_API_KEY");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const body = (await res.json()) as {
    results: Array<{ title: string; url: string; content: string }>;
  };
  return body.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}
