import gptTokenzier from "gpt-tokenizer";
import type { ChatInput, ChatOutput } from "../openai/types";
import { LogLevel } from "../scheduler/logger";
import { ChatManager } from "../scheduler/manager";
import { getChatWorkers, type ChatEndpointManifest } from "./get-chat-workers";

export type SimpleChatInput = Partial<ChatInput> & Pick<ChatInput, "messages">;
export interface SimpleChatProxy {
  (input: SimpleChatInput): Promise<ChatOutput>;
}

const defaultChatInput: ChatInput = {
  messages: [],
  temperature: 0,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  max_tokens: 60,
  stop: "",
};

export interface ProxiesConfig {
  manifests: ChatEndpointManifest[];
  logLevel?: LogLevel;
}

export function plexchat(config: ProxiesConfig) {
  const manager = new ChatManager({
    workers: config.manifests.flatMap((manifest) => getChatWorkers({ logLevel: config.logLevel, ...manifest })),
    logLevel: config.logLevel ?? LogLevel.Info,
  });

  const gpt4Proxy: SimpleChatProxy = (input: SimpleChatInput) =>
    manager.submit({
      tokenDemand: gptTokenzier.encodeChat(input.messages, "gpt-4").length * 1.05 + (input.max_tokens ?? defaultChatInput.max_tokens),
      models: ["gpt-4", "gpt-4-32k"],
      input: {
        ...defaultChatInput,
        ...input,
      },
    });

  const gpt35Proxy: SimpleChatProxy = (input: SimpleChatInput) =>
    manager.submit({
      tokenDemand: gptTokenzier.encodeChat(input.messages, "gpt-3.5-turbo").length * 1.05 + (input.max_tokens ?? defaultChatInput.max_tokens),
      models: ["gpt-35-turbo", "gpt-35-turbo-16k"],
      input: {
        ...defaultChatInput,
        ...input,
      },
    });

  const gptProxy: SimpleChatProxy = (input: SimpleChatInput) =>
    manager.submit({
      tokenDemand: gptTokenzier.encodeChat(input.messages, "gpt-3.5-turbo").length * 1.05 + (input.max_tokens ?? defaultChatInput.max_tokens),
      models: ["gpt-35-turbo", "gpt-35-turbo-16k", "gpt-4", "gpt-4-32k"],
      input: {
        ...defaultChatInput,
        ...input,
      },
    });

  return {
    gptProxy,
    gpt35Proxy,
    gpt4Proxy,
  };
}