import { getTimeoutFunction } from "../controller/timeout";
import { getOpenAIWorkerProxy } from "../openai/proxy";
import type { ModelName } from "../openai/types";
import { LogLevel } from "../scheduler/logger";
import { ChatWorker } from "../scheduler/worker";

export interface ChatEndpointManifest {
  apiKey: string;
  endpoint: string;
  apiVersion?: string;
  logLevel?: LogLevel;
  models: {
    apiVersion?: string;
    contextWindow: number;
    concurrentcy?: number;
    modelName: ModelName;
    deploymentName: string;
    rpm: number;
    tpm: number;
    minTimeoutMs?: number;
    timeoutMsPerToken?: number;
  }[];
}

const defaults = {
  apiVersion: "2023-08-01-preview",
  logLevel: LogLevel.Info,
  minTimeoutMs: 5_000,
  timeoutMsPerToken: 25,
  concurrentcy: 10,
};


export function getChatWorkers(manfest: ChatEndpointManifest) {
  return manfest.models.map((model) => {
    const endpoint = new URL(manfest.endpoint);
    
    if (model.modelName === "text-embedding-ada-002") {
      endpoint.pathname = `/openai/deployments/${model.deploymentName}/embeddings`;
    } else {
      endpoint.pathname = `/openai/deployments/${model.deploymentName}/chat/completions`;
    }

    endpoint.searchParams.set("api-version", model.apiVersion ?? manfest.apiVersion ?? defaults.apiVersion);

    return new ChatWorker({
      proxy: getOpenAIWorkerProxy({
        apiKey: manfest.apiKey,
        endpoint: endpoint.toString(),
      }),
      requestsPerMinute: model.rpm,
      timeout: getTimeoutFunction(model.minTimeoutMs ?? defaults.minTimeoutMs, model.timeoutMsPerToken ?? defaults.timeoutMsPerToken),
      contextWindow: model.contextWindow,
      models: [model.modelName],
      concurrency: model.concurrentcy ?? defaults.concurrentcy,
      tokensPerMinute: model.tpm,
      logLevel: manfest.logLevel ?? defaults.logLevel,
    });
  });
}
