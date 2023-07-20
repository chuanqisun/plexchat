import type { ChatInput, ChatOutput } from "../openai/types";
import { getTokenCapacity } from "./capacity";
import { LogLevel, getLogger, type ILogger } from "./logger";
import { Poller } from "./poller";
import type { IChatTask, IChatWorker, IChatWorkerManager, IWorkerTaskRequest } from "./types";

export interface IPoller {
  // run the event handler at interval, do not start immediately
  set: (eventHandler: any) => void;
  unset: () => void;
}

export interface ChatWorkerConfig {
  proxy: ChatProxy;
  models: string[];
  concurrency: number;
  contextWindow: number;
  tokensPerMinute: number;
  logLevel?: LogLevel;
}

export type ChatProxy = (input: ChatInput, signal?: AbortSignal) => Promise<ChatProxyResult>;

export interface ChatProxyResult {
  data?: ChatOutput;
  error?: string;
  retryAfterMs?: number;
}

export interface TaskRecord {
  startedAt: number;
  tokensDemanded: number;
  tokensUsed?: number;
}

// Chat worker is responsible for polling task when its self has change in capacity
// Only chat manager can stop chat worker polling

export class ChatWorker implements IChatWorker {
  private tasks: IChatTask[] = [];
  private poller: IPoller;
  private previousRequest: IWorkerTaskRequest | null = null;
  private records: TaskRecord[] = [];
  private coolDownUntil = 0;
  private logger: ILogger;

  constructor(private config: ChatWorkerConfig) {
    this.poller = new Poller(100);
    this.logger = getLogger(config.logLevel);
  }

  public start(manager: IChatWorkerManager) {
    this.logger.debug(`[worker] started`);
    // poll immediately because start was requested by the manager
    this.poll(manager, this.updateTaskRequest().request);
    // start interval based polling because capacity might have changed due to timeout
    this.poller.unset();
    this.poller.set(() => {
      const taskRequestChange = this.updateTaskRequest();
      if (taskRequestChange.isChanged) {
        this.poll(manager, taskRequestChange.request);
      }
    });
  }

  public abortAll() {
    this.logger.info(`[worker] abort all tasks`);
    this.poller.unset();

    this.tasks.forEach((task) => {
      task.controller?.abort();
    });
  }

  public stop() {
    this.logger.info(`[worker] stopped`);
    this.poller.unset();
  }

  private updateTaskRequest(): { isChanged: boolean; request: IWorkerTaskRequest } {
    this.updateRecordsWindow();
    const request = this.getTaskRequest();
    const isChanged = JSON.stringify(request)! == JSON.stringify(this.previousRequest);
    this.previousRequest = request;

    return { isChanged, request };
  }

  private updateRecordsWindow() {
    // remove history older than 1 min
    this.records = this.records.filter((r) => r.startedAt > Date.now() - 60_000);
  }

  private getTaskRequest(): IWorkerTaskRequest {
    // BLocked due to cooldown
    if (this.coolDownUntil > Date.now()) {
      return {
        tokenCapacity: 0,
        models: this.config.models,
      };
    }

    // Blocked due to max concurrency
    if (this.tasks.length >= this.config.concurrency) {
      return {
        tokenCapacity: 0,
        models: this.config.models,
      };
    }

    return {
      tokenCapacity: Math.min(this.config.contextWindow, getTokenCapacity(this.config.tokensPerMinute, this.records)),
      models: this.config.models,
    };
  }

  private poll(manager: IChatWorkerManager, request: IWorkerTaskRequest) {
    if (request.tokenCapacity === 0) {
      this.logger.debug(`[worker] skip poll due to 0 capacity`);
      return;
    }

    const task = manager.request(request);
    if (task) {
      this.logger.debug(`[worker] task aquired (asked ${request.tokenCapacity}, got ${task.tokenDemand})`);
      this.tasks.push(task);
      this.runTask(manager, task);
    }
    {
      this.logger.debug(`[worker] no task available`);
    }
  }

  private async runTask(manager: IChatWorkerManager, task: IChatTask) {
    const record: TaskRecord = { startedAt: Date.now(), tokensDemanded: task.tokenDemand };
    this.records.push(record);

    const { error, data, retryAfterMs } = await this.config.proxy(task.input, task.controller?.signal);

    // remove task from running task pool
    record.tokensUsed = data?.usage?.total_tokens;
    this.tasks = this.tasks.filter((t) => t !== task);

    if (!error) {
      manager.respond(task, { data });
    } else {
      if (retryAfterMs !== undefined) {
        this.coolDownUntil = Date.now() + retryAfterMs;
        this.logger.warn(`[worker] cooldown started ${retryAfterMs}ms`);
      }
      manager.respond(task, { error });
    }

    // after each run, restart the poller because capacity might have changed
    // but do not restart if aborted
    if (!task.controller?.signal.aborted) {
      this.start(manager);
    }
  }
}
