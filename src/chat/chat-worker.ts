import type { ChatWorker, OpenAIJsonProxy } from "./chat";

export interface AzureOpenAIChatWorkerConfig {
  model: string;
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
