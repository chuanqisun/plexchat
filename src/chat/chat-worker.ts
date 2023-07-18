import type { ChatWorker, OpenAIJsonProxy } from "./chat";
import type { ModelName } from "./types";

export interface AzureOpenAIChatWorkerConfig {
  model: ModelName;
  tokenLimit: number;
  tokenLimitWindowSize: number;
  proxy: OpenAIJsonProxy;
}

export function azureOpenAIChatWorker(config: AzureOpenAIChatWorkerConfig): ChatWorker {
  const { model, tokenLimit, tokenLimitWindowSize, proxy } = config;

  return {
    id: crypto.randomUUID(),
    proxy,
    spec: {
      models: [model],
      tokenLimit,
      tokenLimitWindowSize,
    },
    historyTasks: [],
  };
}
