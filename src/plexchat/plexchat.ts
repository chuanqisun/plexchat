import { Observable, concatMap, from, lastValueFrom, of, tap } from "rxjs";
import type { ChatInput, ChatModelName, ChatOutput, ChatOutputStreamEvent, EmbedInput, EmbedModelName, EmbedOutput } from "../openai/types";
import { LogLevel } from "../scheduler/logger";
import { ChatManager, type MatchRule, type SortRule, type SweepRule } from "../scheduler/manager";
import type { IChatTaskManagerStatus } from "../scheduler/types";
import { getPlexchatWorkers, type PlexEndpointManifest } from "./plexchat-worker";
import { defaultEstimateChatTokenDemand, defaultEstimateEmbedTokenDemand } from "./token-estimation";

export type SimpleChatProxy = (input: SimpleChatInput, context?: SimpleChatContext) => Promise<ChatOutput>;
export type SimpleChatStreamProxy = (input: SimpleChatStreamInput, context?: SimpleChatContext) => Observable<ChatOutputStreamEvent>;

export type SimpleChatInput = Partial<ChatInput> & Pick<ChatInput, "messages">;
export type SimpleChatStreamInput = Partial<ChatInput> & Pick<ChatInput, "messages"> & { stream: true };
export type SimpleChatContext = { models?: ChatModelName[]; abortHandle?: string; metadata?: Record<string, any> };

export type SimpleEmbedProxy = (input: SimpleEmbedInput, context?: SimpleEmbedContext) => Promise<EmbedOutput>;
export type SimpleEmbedInput = Partial<EmbedInput> & Pick<EmbedInput, "input">;
export type SimpleEmbedContext = { models?: EmbedModelName[]; abortHandle?: string; metadata?: Record<string, any> };

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

export interface PlexchatConfig {
  manifests: PlexEndpointManifest[];
  logLevel?: LogLevel;
  /**
   * Estimate the number of tokens needed for chat task
   * By default, tokens are calculated with gptTokenier
   */
  onEstimateChatTokenDemand?: (input: ChatInput, context?: { models?: ChatModelName[]; signal?: AbortSignal }) => number | Promise<number>;
  /**
   * Estimate the number of tokens needed for embedding task
   * By default, tokens are calculated with gptTokenier
   */
  onEstimateEmbedTokenDemand?: (input: EmbedInput, context?: { models?: EmbedModelName[]; signal?: AbortSignal }) => number | Promise<number>;
  /**
   * Sweep rules reject tasks with error. Use this to clean up hanging tasks that are not making progress
   * By default, sweep rules remove tasks running long than 30 seconds
   */
  onInitSweepRules?: (existingRules: SweepRule[]) => SweepRule[];
  /**
   * Match rules determine whether a worker can pick up a task. Use this to match tasks based on worker capabilities
   * By default, tasks are matched based on model and token demand
   */
  onInitMatchRules?: (existingRules: MatchRule[]) => MatchRule[];
  /**
   * Sort rules determine the order in which tasks are picked up by workers. Use this to prioritize tasks
   * By default, both new and retry tasks are appended to a queue and never sorted.
   */
  onInitSortRules?: (existingRules: SortRule[]) => SortRule[];
}

export interface Plexchat {
  abort: (abortHandle: string) => void;
  abortAll: () => void;
  chatProxy: SimpleChatProxy;
  chatStreamProxy: SimpleChatStreamProxy;
  embedProxy: SimpleEmbedProxy;
  status: () => IChatTaskManagerStatus;
}

export function plexchat(config: PlexchatConfig): Plexchat {
  // The abort handles are only used for out-of-manager tasks, such as token estimation
  const abortHandleMap = new Map<string, AbortController>();
  const ensureController = (abortHandle?: string) => {
    const abortController = abortHandle ? abortHandleMap.get(abortHandle) ?? new AbortController() : new AbortController();
    if (abortHandle && !abortHandleMap.has(abortHandle)) abortHandleMap.set(abortHandle, abortController);
    return abortController;
  };
  const abortByHandle = (abortHandle: string) => {
    abortHandleMap.get(abortHandle)?.abort();
    abortHandleMap.delete(abortHandle);
  };
  const abortAllHandles = () => {
    abortHandleMap.forEach((abortController) => abortController.abort());
    abortHandleMap.clear();
  };

  const manager = new ChatManager({
    workers: config.manifests.flatMap((manifest) => getPlexchatWorkers({ logLevel: config.logLevel, ...manifest })),
    logLevel: config.logLevel ?? LogLevel.Error,
    onInitMatchRules: config.onInitMatchRules,
    onInitSweepRules: config.onInitSweepRules,
    onInitSortRules: config.onInitSortRules,
  });

  const estimators = {
    onEstimateChatTokenDemand: config.onEstimateChatTokenDemand ?? defaultEstimateChatTokenDemand,
    onEstimateEmbedTokenDemand: config.onEstimateEmbedTokenDemand ?? defaultEstimateEmbedTokenDemand,
  };

  const embedProxy: SimpleEmbedProxy = async (input, context) => {
    const { models, abortHandle, metadata } = context ?? {};

    const abortController = ensureController(abortHandle);

    const tokenDemand = await estimators.onEstimateEmbedTokenDemand(input, { signal: abortController.signal });

    const subject = manager.submit({
      tokenDemand,
      models: models ?? ["text-embedding-ada-002"],
      abortHandle,
      input,
      metadata,
    });

    return lastValueFrom(subject);
  };

  const chatProxy: SimpleChatProxy = async (input, context) => {
    const { models, abortHandle, metadata } = context ?? {};
    const finalInput = { ...defaultChatInput, ...input };

    const abortController = ensureController(abortHandle);

    const $task = from(Promise.resolve(estimators.onEstimateChatTokenDemand(finalInput, { signal: abortController.signal }))).pipe(
      tap(() => abortController.signal.throwIfAborted()),
      concatMap((tokenDemand) =>
        manager.submit({
          tokenDemand,
          models: models ?? ["gpt-3.5-turbo", "gpt-3.5-turbo-16k"],
          abortHandle,
          input: finalInput,
          metadata,
        })
      )
    );

    return lastValueFrom($task);
  };

  const chatStreamProxy: SimpleChatStreamProxy = (input, context) => {
    const { models, abortHandle, metadata } = context ?? {};
    const finalInput = { ...defaultChatInput, ...input };

    const abortController = ensureController(abortHandle);

    return of(null).pipe(
      tap({ unsubscribe: () => abortController.abort() }),
      concatMap(() => Promise.resolve(estimators.onEstimateChatTokenDemand(finalInput, { signal: abortController.signal }))),
      tap(() => abortController.signal.throwIfAborted()),
      concatMap((tokenDemand) =>
        manager.submit({
          tokenDemand,
          models: models ?? ["gpt-3.5-turbo", "gpt-3.5-turbo-16k"],
          abortHandle,
          input: finalInput,
          metadata,
        })
      )
    );
  };

  const abortAll = () => {
    abortAllHandles();
    manager.abortAll();
  };

  const abort = (abortHandle: string) => {
    abortByHandle(abortHandle);
    manager.abort((task) => task.abortHandle === abortHandle);
  };
  const status = () => manager.status();

  return {
    abort,
    abortAll,
    chatProxy,
    chatStreamProxy,
    embedProxy,
    status,
  };
}
