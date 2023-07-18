import { type ChatTaskRunner } from "./chat";
import { azureOpenAIChatTask } from "./chat-task";
import type { ChatInput, ChatMessage, ModelName } from "./types";

export interface SimpleChatModelConfig extends Partial<Exclude<ChatInput, "message">> {
  models?: ModelName[];
  retry?: number;
}

export interface SimpleChatConfig {
  chatTaskRunner: ChatTaskRunner;
  getTokenCount: (messages: ChatMessage[]) => number;
}

export function getSimpleRESTChat(config: SimpleChatConfig) {
  return async (messages: ChatMessage[], modelConfig?: SimpleChatModelConfig) => {
    return new Promise<string>((resolve, reject) => {
      const maxTokens = modelConfig?.max_tokens ?? 60;
      const task = azureOpenAIChatTask({
        input: {
          messages,
          temperature: 0,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
          max_tokens: maxTokens,
          stop: "",
          ...modelConfig,
        },
        retryLeft: modelConfig?.retry ?? 3,
        demand: {
          totalTokens: maxTokens + config.getTokenCount(messages),
          models: modelConfig?.models ?? ["gpt-35-turbo", "gpt-35-turbo-16k", "gpt-4", "gpt-4-32k"],
        },
        onSuccess: (chatOutput) => resolve(chatOutput.choices[0].message?.content ?? ""),
        onError: reject,
      });
      config.chatTaskRunner(task);
    });
  };
}
