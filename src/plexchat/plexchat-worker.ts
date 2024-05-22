import { getTimeoutFunction } from "../controller/timeout";
import { getOpenAIWorkerProxy } from "../openai/proxy";
import type { ChatModelName, EmbedModelName } from "../openai/types";
import { LogLevel, getLogger } from "../scheduler/logger";
import { ChatWorker } from "../scheduler/worker";

export interface PlexEndpointManifest {
  apiKey: string;
  endpoint: string;
  apiVersion?: string;
  logLevel?: LogLevel;
  models: {
    apiVersion?: string;
    contextWindow: number;
    concurrentcy?: number;
    modelName: ChatModelName | EmbedModelName;
    deploymentName: string;
    rpm: number;
    tpm: number;
    minTimeoutMs?: number;
    timeoutMsPerToken?: number;
  }[];
  metadata?: Record<string, any>;
}

const defaults = {
  apiVersion: "2024-02-01",
  logLevel: LogLevel.Info,
  minTimeoutMs: 5_000,
  timeoutMsPerToken: 25,
  concurrentcy: 10,
};

export function getPlexchatWorkers(manfest: PlexEndpointManifest) {
  return manfest.models.map((model) => {
    const endpoint = new URL(manfest.endpoint);
    const logLevel = manfest.logLevel ?? defaults.logLevel;

    const logger = getLogger(logLevel);

    if (model.modelName === "text-embedding-ada-002") {
      endpoint.pathname = `/openai/deployments/${model.deploymentName}/embeddings`;
    } else {
      endpoint.pathname = `/openai/deployments/${model.deploymentName}/chat/completions`;
    }

    endpoint.searchParams.set("api-version", model.apiVersion ?? manfest.apiVersion ?? defaults.apiVersion);

    logger.info(`Init ${model.modelName} model worker endpoint: ${endpoint.toString()}`);

    return new ChatWorker({
      proxy: getOpenAIWorkerProxy({
        apiKey: manfest.apiKey,
        endpoint: endpoint.toString(),
        logger,
      }),
      requestsPerMinute: model.rpm,
      timeout: getTimeoutFunction(model.minTimeoutMs ?? defaults.minTimeoutMs, model.timeoutMsPerToken ?? defaults.timeoutMsPerToken),
      contextWindow: model.contextWindow,
      models: [model.modelName],
      concurrency: model.concurrentcy ?? defaults.concurrentcy,
      tokensPerMinute: model.tpm,
      logLevel: manfest.logLevel ?? defaults.logLevel,
      metadata: manfest.metadata,
    });
  });
}
