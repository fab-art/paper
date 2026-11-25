import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createRateLimitGate,
  readSearchCache,
  retryAfterSeconds,
  searchCacheKey,
  writeSearchCache
} from "./search-cache.mjs";

const allowedMethods = ["POST", "OPTIONS"];
const searchCache = new Map<string, { value: unknown; expiresAt: number }>();
const rateLimitGate = createRateLimitGate();

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

  const cacheKey = searchCacheKey(query, limit);
  const cachedPapers = readSearchCache(searchCache, cacheKey);
  if (cachedPapers !== null) {
    res.setHeader("X-Search-Cache", "HIT");
    return res.status(200).json({ query, papers: cachedPapers });
  }
  res.setHeader("X-Search-Cache", "MISS");

  const cooldownSeconds = rateLimitGate.retryAfter();
  if (cooldownSeconds > 0) {
    res.setHeader("Retry-After", String(cooldownSeconds));
    res.setHeader("X-Search-Cache", "RATE_LIMIT_BACKOFF");
    return res.status(429).json({
      detail: `Semantic Scholar rate limit is active. Please retry in about ${cooldownSeconds} seconds.`,
      retryAfterSeconds: cooldownSeconds
    });
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

    if (upstream.status === 429) {
      const retrySeconds = retryAfterSeconds(upstream.headers.get("retry-after"));
      rateLimitGate.blockFor(retrySeconds);
      res.setHeader("Retry-After", String(retrySeconds));
      return res.status(429).json({
        detail: `Semantic Scholar rate limit reached. Please retry in about ${retrySeconds} seconds.`,
        retryAfterSeconds: retrySeconds
      });
    }

    if (!upstream.ok) {
      return res.status(502).json({
        detail: `Semantic Scholar returned HTTP ${upstream.status}.`
      });
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

    writeSearchCache(searchCache, cacheKey, papers);
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    return res.status(200).json({ query, papers });
  } catch (error) {
    return res.status(502).json({
      detail: error instanceof Error ? error.message : "Paper search failed."
    });
  }
}
