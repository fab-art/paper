import { executeDescriptiveAnalysis, type DescriptiveAnalysisInput } from "../lib/research-analysis";

self.onmessage = (event: MessageEvent<DescriptiveAnalysisInput>) => {
  try {
    const result = executeDescriptiveAnalysis(event.data);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "The descriptive analysis could not be completed." });
  }
};
