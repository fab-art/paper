import type { VercelRequest, VercelResponse } from "@vercel/node";
import { normalizeEnginePath } from "./path.mjs";

const ALLOWED = new Set(["generate-plot", "compile-latex", "health"]);
const WINDOW_SECONDS = 60;

async function enforceRateLimit(req: VercelRequest, path: string) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return { configured: false, allowed: false, limit: 0, remaining: 0 };
  }

  const forwarded = req.headers["x-forwarded-for"];
  const rawIp = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.headers["x-real-ip"] || "unknown");
  const ip = rawIp.split(",")[0].trim().slice(0, 80) || "unknown";
  const limit = path === "compile-latex" ? 4 : 20;
  const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
  const key = encodeURIComponent(`paperorchestra:compute:${path}:${ip}:${bucket}`);
  const headers = { Authorization: "Bearer " + redisToken };

  const increment = await fetch(`${redisUrl}/incr/${key}`, { headers });
  if (!increment.ok) throw new Error("Rate-limit service rejected the request.");
  const payload = await increment.json() as { result?: number };
  const count = Number(payload.result || 0);
  const expiry = await fetch(`${redisUrl}/expire/${key}/${WINDOW_SECONDS}`, { headers });
  if (!expiry.ok) throw new Error("Could not set the rate-limit window.");
  return { configured: true, allowed: count <= limit, limit, remaining: Math.max(0, limit - count) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = normalizeEnginePath(req.query.path);
  if (!ALLOWED.has(path)) return res.status(404).json({ detail: "Unknown engine endpoint." });

  const base = process.env.PAPERORCHESTRA_ENGINE_URL?.replace(/\/$/, "");
  if (!base) return res.status(503).json({ detail: "Engine service is not configured. Deploy the backend to Railway and set PAPERORCHESTRA_ENGINE_URL in Vercel." });

  if (path === "health" && req.method === "GET") {
    try {
      const r = await fetch(base + "/api/health", { signal: AbortSignal.timeout(8000) });
      return res.status(r.status).json(await r.json().catch(() => ({})));
    } catch {
      return res.status(502).json({ detail: "The remote compute engine is unreachable." });
    }
  }
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed." });

  try {
    const rate = await enforceRateLimit(req, path);
    if (!rate.configured) {
      return res.status(503).json({ detail: "Compute requests are disabled until UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are configured for abuse protection." });
    }
    res.setHeader("X-RateLimit-Limit", String(rate.limit));
    res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(WINDOW_SECONDS));
      return res.status(429).json({ detail: `Rate limit reached: ${rate.limit} ${path === "compile-latex" ? "compilations" : "plot requests"} per minute per IP.` });
    }
  } catch {
    return res.status(503).json({ detail: "Rate-limit service is temporarily unavailable. Remote compute is blocked; use the browser fallback or try again shortly." });
  }

  const token = process.env.PAPERORCHESTRA_ENGINE_TOKEN;
  if (!token) return res.status(503).json({ detail: "PAPERORCHESTRA_ENGINE_TOKEN is not configured in Vercel." });
  try {
    const r = await fetch(base + "/api/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(path === "compile-latex" ? 55000 : 25000)
    });
    const body = await r.json().catch(() => ({ detail: "Compute engine returned an invalid response." }));
    return res.status(r.status).json(body);
  } catch (e) {
    return res.status(502).json({ detail: e instanceof Error ? e.message : "Remote compute request failed." });
  }
}
export const config = { maxDuration: 60 };
