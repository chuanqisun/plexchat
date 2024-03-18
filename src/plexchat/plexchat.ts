import type { ChatInput, ChatModelName, ChatOutput, EmbedInput, EmbedModelName, EmbedOutput } from "../openai/types";
import { LogLevel } from "../scheduler/logger";
import { ChatManager } from "../scheduler/manager";
import { getPlexchatWorkers, type PlexEndpointManifest } from "./plexchat-worker";
import { defaultEstimateChatTokenDemand, defaultEstimateEmbedTokenDemand } from "./token-estimation";

export type SimpleChatProxy = (input: SimpleChatInput, context?: SimpleChatContext) => Promise<ChatOutput>;
export type SimpleChatInput = Partial<ChatInput> & Pick<ChatInput, "messages">;
export type SimpleChatContext = { models?: ChatModelName[]; abortHandle?: string };

export type SimpleEmbedProxy = (input: SimpleEmbedInput, context?: SimpleEmbedContext) => Promise<EmbedOutput>;
export type SimpleEmbedInput = Partial<EmbedInput> & Pick<EmbedInput, "input">;
export type SimpleEmbedContext = { models?: EmbedModelName[]; abortHandle?: string };

export interface SchedulerConfig {
  onEstimateChatTokenDemand?: (input: ChatInput) => number | Promise<number>;
  onEstimateEmbedTokenDemand?: (input: EmbedInput) => number | Promise<number>;
}

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
  scheduler?: SchedulerConfig;
}

export function plexchat(config: ProxiesConfig) {
  const manager = new ChatManager({
    workers: config.manifests.flatMap((manifest) => getPlexchatWorkers({ logLevel: config.logLevel, ...manifest })),
    logLevel: config.logLevel ?? LogLevel.Error,
  });

  const schedulerConfig = {
    onEstimateChatTokenDemand: defaultEstimateChatTokenDemand,
    onEstimateEmbedTokenDemand: defaultEstimateEmbedTokenDemand,
    ...config.scheduler,
  };

  const embedProxy: SimpleEmbedProxy = async (input, context) => {
    const { models, abortHandle } = context ?? {};
    const tokenDemand = await schedulerConfig.onEstimateEmbedTokenDemand(input);

    return manager.submit({
      tokenDemand,
      models: models ?? ["text-embedding-ada-002"],
      abortHandle,
      input,
    });
  };

  const chatProxy: SimpleChatProxy = async (input, context) => {
    const { models, abortHandle } = context ?? {};
    const finalInput = { ...defaultChatInput, ...input };

    return manager.submit({
      tokenDemand: await schedulerConfig.onEstimateChatTokenDemand(finalInput),
      models: models ?? ["gpt-35-turbo", "gpt-35-turbo-16k"],
      abortHandle,
      input: finalInput,
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
