import gptTokenzier from "gpt-tokenizer";
import type { ChatInput, ChatOutput, ModelName } from "../openai/types";
import { LogLevel } from "../scheduler/logger";
import { ChatManager } from "../scheduler/manager";
import { getChatWorkers, type ChatEndpointManifest } from "./get-chat-workers";

export type SimpleChatInput = Partial<ChatInput> & Pick<ChatInput, "messages"> & { models?: ModelName[] };
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

  const chatProxy: SimpleChatProxy = (input: SimpleChatInput) => {
    const { models, ...standardInput } = input;

    const chatTokenDemand = gptTokenzier.encodeChat(input.messages, "gpt-3.5-turbo").length * 1.2;
    const functionCallTokenDemand = input.functions ? gptTokenzier.encode(JSON.stringify(input.functions)).length * 1.2 : 0;
    const responseTokenDemand = input.max_tokens ?? defaultChatInput.max_tokens;

    return manager.submit({
      tokenDemand: chatTokenDemand + functionCallTokenDemand + responseTokenDemand,
      models: models ?? ["gpt-35-turbo", "gpt-35-turbo-16k"],
      input: {
        ...defaultChatInput,
        ...standardInput,
      },
    });
  };

  return {
    chatProxy,
  };
}
