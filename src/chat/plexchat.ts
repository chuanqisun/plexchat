import gptTokenzier from "gpt-tokenizer";
import type { ChatInput, ChatOutput, ModelName } from "../openai/types";
import { LogLevel } from "../scheduler/logger";
import { ChatManager } from "../scheduler/manager";
import { getChatWorkers, type ChatEndpointManifest } from "./get-chat-workers";

export type SimpleChatInput = Partial<ChatInput> & Pick<ChatInput, "messages"> & { models?: ModelName[] };

export type SimpleEmbedProxy = (input: string[]) => Promise<{ embedding: number[] }[]>;

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
    logLevel: config.logLevel ?? LogLevel.Error,
  });

  const embedProxy: SimpleEmbedProxy = (texts: string[]) => {
    const tokenDemand = texts.map((str) => gptTokenzier.encode(str)).reduce((acc, cur) => acc + cur.length, 0);

    return manager
      .submit({
        tokenDemand,
        models: ["text-embedding-ada-002"],
        input: { input: texts },
      })
      .then((result) => result.data);
  };

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

  const abortAll = () => manager.abortAll();

  return {
    abortAll,
    chatProxy,
    embedProxy,
  };
}
