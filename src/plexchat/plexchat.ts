import gptTokenzier from "gpt-tokenizer";
import type { ChatInput, ChatModelName, ChatOutput, EmbedModelName } from "../openai/types";
import { LogLevel } from "../scheduler/logger";
import { ChatManager } from "../scheduler/manager";
import { getPlexchatWorkers, type PlexEndpointManifest } from "./plexchat-worker";

export type SimpleChatProxy = (input: SimpleChatInput, context?: SimpleChatContext) => Promise<ChatOutput>;
export type SimpleChatInput = Partial<ChatInput> & Pick<ChatInput, "messages">;
export type SimpleChatContext = { models?: ChatModelName[]; abortHandle?: string };

export type SimpleEmbedProxy = (input: string[], context?: SimpleEmbedContext) => Promise<{ embedding: number[] }[]>;
export type SimpleEmbedContext = { models?: EmbedModelName[]; abortHandle?: string };

export interface TaskContext {
  abortHandle?: string;
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
  manifests: PlexEndpointManifest[];
  logLevel?: LogLevel;
}

export function plexchat(config: ProxiesConfig) {
  const manager = new ChatManager({
    workers: config.manifests.flatMap((manifest) => getPlexchatWorkers({ logLevel: config.logLevel, ...manifest })),
    logLevel: config.logLevel ?? LogLevel.Error,
  });

  const embedProxy: SimpleEmbedProxy = (input, context) => {
    const { models, abortHandle } = context ?? {};
    const tokenDemand = input.map((str) => gptTokenzier.encode(str)).reduce((acc, cur) => acc + cur.length, 0);

    return manager
      .submit({
        tokenDemand,
        models: models ?? ["text-embedding-ada-002"],
        abortHandle,
        input: { input },
      })
      .then((result) => result.data);
  };

  const chatProxy: SimpleChatProxy = (input, context) => {
    const { models, abortHandle } = context ?? {};

    const chatTokenDemand = gptTokenzier.encodeChat(input.messages, "gpt-3.5-turbo").length * 1.2;
    const functionCallTokenDemand = input.functions ? gptTokenzier.encode(JSON.stringify(input.functions)).length * 1.2 : 0;
    const responseTokenDemand = input.max_tokens ?? defaultChatInput.max_tokens;

    return manager.submit({
      tokenDemand: chatTokenDemand + functionCallTokenDemand + responseTokenDemand,
      models: models ?? ["gpt-35-turbo", "gpt-35-turbo-16k"],
      abortHandle,
      input: {
        ...defaultChatInput,
        ...input,
      },
    });
  };

  const abortAll = () => manager.abortAll();
  const abort = (abortHandle: string) => manager.abort((task) => task.abortHandle === abortHandle);

  return {
    abort,
    abortAll,
    chatProxy,
    embedProxy,
  };
}
