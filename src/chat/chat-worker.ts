import type { ChatWorker, OpenAIJsonProxy } from "./chat";
import type { ModelName } from "./types";

export interface AzureOpenAIChatWorkerConfig {
  model: ModelName;
  parallelism: number;
  tokenLimit: number;
  tokenLimitWindowSize: number;
  proxy: OpenAIJsonProxy;
}

export function azureOpenAIChatWorker(config: AzureOpenAIChatWorkerConfig): ChatWorker {
  const { model, parallelism, tokenLimit, tokenLimitWindowSize, proxy } = config;

  return {
    id: crypto.randomUUID(),
    proxy,
    spec: {
      parallelism,
      models: [model],
      tokenLimit,
      tokenLimitWindowSize,
    },
    historyTasks: [],
  };
}
