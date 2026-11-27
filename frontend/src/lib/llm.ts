import type { MLCEngineInterface } from "@mlc-ai/web-llm";

export const MODEL_OPTIONS = [
  { id: "Qwen2.5-3B-Instruct-q4f16_1-MLC", label: "Qwen2.5 3B (recommended)" },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", label: "Phi-3.5 Mini" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B" }
] as const;

type ModelLoadProgress = { text: string; progress: number };

let engine: MLCEngineInterface | null = null;
let worker: Worker | null = null;

export async function loadLocalModel(
  modelId: string,
  onProgress: (text: string, progress: number) => void,
  contextWindow = 8192
) {
  if (engine) return engine;
  if (!("gpu" in navigator)) throw new Error("WebGPU is not available in this browser.");

  const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
  worker = new Worker(new URL("../workers/webllm.worker.ts", import.meta.url), { type: "module" });
  try {
    engine = await CreateWebWorkerMLCEngine(worker, modelId, {
      initProgressCallback: (report: ModelLoadProgress) => onProgress(report.text, report.progress),
      context_window_size: contextWindow
    } as never);
    return engine;
  } catch (error) {
    worker.terminate();
    worker = null;
    engine = null;
    throw error;
  }
}

export function getEngine() { return engine; }

export async function unloadModel() {
  if (engine) {
    await engine.unload();
    engine = null;
  }
  worker?.terminate();
  worker = null;
}

export async function complete(prompt: string, onToken?: (token: string) => void): Promise<string> {
  if (!engine) throw new Error("Load a local model first.");
  const started = performance.now();
  let output = "";
  const stream = await engine.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.25,
    max_tokens: 1800,
    stream: true
  });
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || "";
    output += token;
    onToken?.(token);
  }
  const elapsed = Math.max((performance.now() - started) / 1000, 0.1);
  window.dispatchEvent(new CustomEvent("studio:tokens", { detail: output.length / 4 / elapsed }));
  return output;
}

export async function fallbackComplete(endpoint: string, model: string, prompt: string) {
  const response = await fetch(endpoint.replace(/\/$/, "") + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.25 })
  });
  if (!response.ok) throw new Error("Local endpoint returned " + response.status + ". Check endpoint CORS and model name.");
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}


/** Runs a bounded completion with policy instructions isolated in the system role. */
export async function completeWithSystem(
  systemPrompt: string,
  userPrompt: string,
  onToken?: (token: string) => void
): Promise<string> {
  if (!engine) throw new Error("Load a local model first.");
  const started = performance.now();
  let output = "";
  const stream = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.25,
    max_tokens: 1800,
    stream: true
  });
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || "";
    output += token;
    onToken?.(token);
  }
  const elapsed = Math.max((performance.now() - started) / 1000, 0.1);
  window.dispatchEvent(new CustomEvent("studio:tokens", { detail: output.length / 4 / elapsed }));
  return output;
}
