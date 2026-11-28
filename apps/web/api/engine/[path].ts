import type { VercelRequest, VercelResponse } from "@vercel/node";
import { normalizeEnginePath } from "./path.mjs";

const ALLOWED = new Set(["generate-plot", "compile-latex", "health"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = normalizeEnginePath(req.query.path);
  if (!ALLOWED.has(path)) return res.status(404).json({ detail: "Unknown engine endpoint." });

  const base = process.env.PAPERORCHESTRA_ENGINE_URL?.replace(/\/$/, "");
  if (!base) return res.status(503).json({ detail: "Render compute engine is not configured. Set PAPERORCHESTRA_ENGINE_URL in Vercel." });

  if (path === "health" && req.method === "GET") {
    try {
      const r = await fetch(base + "/api/health", { signal: AbortSignal.timeout(8000) });
      return res.status(r.status).json(await r.json().catch(() => ({})));
    } catch {
      return res.status(502).json({ detail: "The remote compute engine is unreachable." });
    }
  }
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed." });

  const token = process.env.PAPERORCHESTRA_ENGINE_TOKEN;
  if (!token) return res.status(503).json({ detail: "PAPERORCHESTRA_ENGINE_TOKEN is not configured in Vercel." });

  const forwarded = req.headers["x-forwarded-for"];
  const forwardedFor = Array.isArray(forwarded)
    ? forwarded.join(",")
    : String(forwarded || req.headers["x-real-ip"] || "");

  try {
    const r = await fetch(base + "/api/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        "X-Forwarded-For": forwardedFor,
      },
      body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(path === "compile-latex" ? 55000 : 25000)
    });
    for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "retry-after"]) {
      const value = r.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    const body = await r.json().catch(() => ({ detail: "Compute engine returned an invalid response." }));
    return res.status(r.status).json(body);
  } catch (e) {
    return res.status(502).json({ detail: e instanceof Error ? e.message : "Remote compute request failed." });
  }
}
export const config = { maxDuration: 60 };
