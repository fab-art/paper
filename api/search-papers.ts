import type { VercelRequest, VercelResponse } from "@vercel/node";

const allowedMethods = ["POST", "OPTIONS"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", allowedMethods.join(","));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  const limit = Math.min(20, Math.max(1, Number(req.body?.limit) || 6));
  if (query.length < 3 || query.length > 500) {
    return res.status(400).json({ detail: "Search query must contain 3–500 characters." });
  }

  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: "title,authors,year,abstract,url,externalIds,openAccessPdf,venue,citationCount,publicationDate"
  });
  try {
    const upstream = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`, {
      headers: process.env.SEMANTIC_SCHOLAR_API_KEY
        ? { "x-api-key": process.env.SEMANTIC_SCHOLAR_API_KEY }
        : {},
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) {
      const message = upstream.status === 429
        ? "Semantic Scholar rate limit reached. Wait briefly and try again."
        : `Semantic Scholar returned HTTP ${upstream.status}.`;
      return res.status(502).json({ detail: message });
    }
    const payload = await upstream.json();
    const papers = (payload.data || []).map((item: any) => ({
      title: item.title || "Untitled paper",
      authors: (item.authors || []).map((a: any) => a.name).filter(Boolean),
      year: item.year ?? undefined,
      abstract: item.abstract ?? undefined,
      url: item.url ?? undefined,
      doi: item.externalIds?.DOI ?? undefined,
      venue: item.venue ?? undefined,
      citationCount: item.citationCount ?? undefined,
      openAccessPdf: item.openAccessPdf?.url ?? undefined,
      publicationDate: item.publicationDate ?? undefined
    }));
    return res.status(200).json({ query, papers });
  } catch (error) {
    return res.status(502).json({
      detail: error instanceof Error ? error.message : "Paper search failed."
    });
  }
}
