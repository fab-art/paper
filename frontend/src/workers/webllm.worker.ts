/// <reference lib="webworker" />
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// WebLLM owns model execution in this worker, keeping token generation off the UI thread.
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (event: MessageEvent) => handler.onmessage(event);
export {};
