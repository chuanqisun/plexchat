import { catchError, first, last, map, of, tap, type Observable } from "rxjs";
import { TIMEOUT_ABORT_REASON, withTimeout } from "../controller/timeout";
import { RetryableError } from "../openai/proxy";
import { getCapacity, getWindowedUsage } from "./capacity";
import { LogLevel, getLogger, type ILogger } from "./logger";
import { Poller } from "./poller";
import type { IChatTask, IChatWorker, IChatWorkerManager, IWorkerTaskRequest } from "./types";

export interface IPoller {
  // run the event handler at interval, do not start immediately
  set: (eventHandler: any) => void;
  unset: () => void;
}

export interface ChatWorkerConfig {
  proxy: WorkerChatProxy;
  models: string[];
  concurrency: number;
  contextWindow: number;
  requestsPerMinute: number;
  timeout: (tokenDemand: number) => number;
  tokensPerMinute: number;
  logLevel?: LogLevel;
  metadata?: Record<string, any>;
}

/** The proxy must convert all possible errors to the Result type  */
export type WorkerChatProxy = (input: any, init?: RequestInit) => Observable<any>;

export interface WorkerChatProxyResult {
  data?: any;
  error?: string;
  retryAfterMs?: number;
}

export interface TaskRecord {
  startedAt: number;
  tokensDemanded: number;
  /**
   * TODO: revise record based on actual token consumption.
   * At the moment:
   * It is unclear whether Azure uses actual token consumption in rate limit
   * In addition, streaming mode does not produce token usage stats
   */
}

export interface WorkerTaskHandle {
  controller: AbortController;
  task: IChatTask;
}

// Chat worker is responsible for polling task when its self has change in capacity
// Only chat manager can stop chat worker polling

export class ChatWorker implements IChatWorker {
  /** Only running tasks */
  private tasks: WorkerTaskHandle[] = [];
  private poller: IPoller;
  private previousRequest: IWorkerTaskRequest | null = null;
  /** Records are temporary for capacity calculation. It may outlive the task list */
  private capacityRecords: TaskRecord[] = [];
  private coolDownUntil = 0;
  private logger: ILogger;

  constructor(private config: ChatWorkerConfig) {
    this.poller = new Poller(100);
    this.logger = getLogger(config.logLevel);
  }

  public status() {
    const usedPerMinute = getWindowedUsage(60_000, this.capacityRecords);
    return {
      models: this.config.models,
      tokensPerMinute: this.config.tokensPerMinute,
      tokensPerMinuteUsed: usedPerMinute.tokens,
      requestsPerMinute: this.config.requestsPerMinute,
      requestsPerMinuteUsed: usedPerMinute.requests,
    };
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

  public abort(selectTask: (task: IChatTask) => boolean) {
    const tasksToAbort = this.tasks.filter((t) => selectTask(t.task));
    if (tasksToAbort.length === 0) {
      this.logger.info(`[worker] abort no task`);
      return;
    } else if (tasksToAbort.length === this.tasks.length) {
      this.logger.info(`[worker] abort all tasks`);
      this.abortAll();
      return;
    } else {
      this.logger.info(`[worker] abort ${tasksToAbort.length} tasks`);

      tasksToAbort.forEach((task) => {
        task.controller?.abort();
      });
    }
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
    this.capacityRecords = this.capacityRecords.filter((r) => r.startedAt > Date.now() - 60_000);
  }

  private getTaskRequest(): IWorkerTaskRequest {
    // Blocked due to cooldown
    if (this.coolDownUntil > Date.now()) {
      this.logger.debug(`[worker] skip poll due to cooldown`);
      return {
        tokenCapacity: 0,
        models: this.config.models,
        metadata: this.config.metadata,
      };
    }

    // Blocked due to max concurrency
    if (this.tasks.length >= this.config.concurrency) {
      this.logger.debug(`[worker] skip poll due to concurrency limit`);
      return {
        tokenCapacity: 0,
        models: this.config.models,
        metadata: this.config.metadata,
      };
    }

    const capacity = getCapacity(this.config.requestsPerMinute, this.config.tokensPerMinute, this.capacityRecords);

    // Blocked due to Requests limit
    if (capacity.requests === 0) {
      this.logger.debug(`[worker] skip poll due to request limit`);
      return {
        tokenCapacity: 0,
        models: this.config.models,
        metadata: this.config.metadata,
      };
    }

    const poll = {
      tokenCapacity: Math.min(this.config.contextWindow, capacity.tokens),
      models: this.config.models,
      metadata: this.config.metadata,
    };
    this.logger.debug(`[worker] polling`, {
      tokenCapacity: poll.tokenCapacity,
      models: poll.models,
    });

    return poll;
  }

  private poll(manager: IChatWorkerManager, request: IWorkerTaskRequest) {
    if (request.tokenCapacity === 0) {
      this.logger.debug(`[worker] skip poll due to 0 capacity`);
      return;
    }

    const task = manager.request(request);
    if (task) {
      this.logger.debug(`[worker] task aquired (asked ${request.tokenCapacity}, got ${task.tokenDemand})`);
      const taskHandle: WorkerTaskHandle = {
        controller: new AbortController(),
        task,
      };
      this.tasks.push(taskHandle);
      this.runTask(manager, taskHandle);
    }
    {
      this.logger.debug(`[worker] no task available`);
    }
  }

  private async runTask(manager: IChatWorkerManager, taskHandle: WorkerTaskHandle) {
    const record: TaskRecord = { startedAt: Date.now(), tokensDemanded: taskHandle.task.tokenDemand };
    this.capacityRecords.push(record);

    const unwatch = withTimeout(TIMEOUT_ABORT_REASON, this.config.timeout(taskHandle.task.tokenDemand), taskHandle.controller);

    // we rely on the abort signal to trigger an error. There is no need to manually unsubscribe
    let wasEmitting = false;
    const subscription = this.config
      .proxy(taskHandle.task.input, { signal: taskHandle.controller.signal })
      .pipe(
        map((result) => ({ data: result, error: undefined })),
        tap((successResponse) => {
          manager.respond(taskHandle.task, successResponse);
          wasEmitting = true;
        }),
        last(), // take last success
        catchError((error) => {
          // handle cooldown
          if ((error as RetryableError).retryAfterMs !== undefined) {
            this.coolDownUntil = Date.now() + error.retryAfterMs;
            this.logger.warn(`[worker] reject task with cooldown ${error.retryAfterMs}ms`);
          }

          // log timeout rejection
          if (taskHandle.controller.signal.reason === TIMEOUT_ABORT_REASON) {
            this.logger.warn(`[worker] reject task without cooldown due to timeout`);
          }

          return of({ data: undefined, error: (error as any)?.message ?? "Unknown error" });
        }),
        first(), // take first error
        map((firstErrorOrLastResult) => {
          this.tasks = this.tasks.filter((t) => t !== taskHandle);
          const isUserAborted = taskHandle.controller.signal.aborted && taskHandle.controller.signal.reason.abortReason !== TIMEOUT_ABORT_REASON;

          // we must NOT retry once some data is emitted
          const shouldRetry = !wasEmitting && !isUserAborted && firstErrorOrLastResult.error !== undefined;

          manager.close(taskHandle.task, { error: firstErrorOrLastResult.error, shouldRetry });
          unwatch();

          // After each run, restart the poller because capacity might have changed
          // But do not restart if user wants to stop the program
          if (!isUserAborted) this.start(manager);
        })
      )
      .subscribe();
  }
}
