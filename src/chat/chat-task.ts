import type { ChatTask, ChatTaskDemand } from "./chat";
import type { ChatInput, ChatOutput } from "./types";

export interface AzureOpenAIChatTaskConfig {
  demand: ChatTaskDemand;
  input: ChatInput;
  retryLeft: number;
  onSuccess: (output: ChatOutput) => void;
  onError: (error: any) => void;
}
export function azureOpenAIChatTask(config: AzureOpenAIChatTaskConfig): ChatTask {
  return {
    id: crypto.randomUUID(),
    ...config,
  };
}
