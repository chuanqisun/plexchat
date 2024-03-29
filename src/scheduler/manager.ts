import { LogLevel, getLogger, type ILogger } from "./logger";
import { globalTimeout, matchByModel, matchByToken } from "./rules";
import type { IChatTask, IChatTaskManager, IChatWorker, IChatWorkerManager, IWorkerTaskRequest, IWorkerTaskResponse } from "./types";

interface TaskHandle {
  task: IChatTask;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  isRunning?: boolean;
  retryLeft: number;
  createdAt: number;
}

export interface ChatManagerConfig {
  workers: IChatWorker[];
  logLevel?: LogLevel;
  onInitMatchRules?: (baseRules: MatchRule[]) => MatchRule[];
  onInitSweepRules?: (baseRules: SweepRule[]) => SweepRule[];
  onInitSortRules?: (baseRules: SortRule[]) => SortRule[];
}

export type MatchRule = (workerTaskRequest: IWorkerTaskRequest, candidateTask: IChatTask) => boolean;
export type SweepRule = (task: SweepTaskHandle) => SweepResult;
export interface SweepTaskHandle {
  task: IChatTask;
  isRunning?: boolean;
  retryLeft: number;
  createdAt: number;
}
export interface SweepResult {
  shouldRemove: boolean;
  reason?: string;
}

export interface SortTaskHandle {
  task: IChatTask;
  retryLeft: number;
  createdAt: number;
}
export type SortRule = (a: SortTaskHandle, b: SortTaskHandle) => number;

export class ChatManager implements IChatTaskManager, IChatWorkerManager {
  static DEFAULT_SWEEP_INTERVAL_MS = 5_000;
  static MIN_SWEEP_INTERVAL_MS = 100;
  static DEFAULT_GLOBAL_TIMEOUT_MS = 30_000;

  private workers: IChatWorker[];
  private taskHandles: TaskHandle[] = [];
  private logger: ILogger;
  private matchRules: MatchRule[];
  private sweepRules: SweepRule[];
  private sortRules: SortRule[];
  private taskSweepIntervalMs: number;

  constructor(config: ChatManagerConfig) {
    this.workers = config.workers;
    this.logger = getLogger(config.logLevel);
    this.matchRules = this.getInitialMatchRules(config.onInitMatchRules);
    this.sweepRules = this.getInitialSweepRules(config.onInitSweepRules);
    this.sortRules = config.onInitSortRules?.([]) ?? [];
    this.taskSweepIntervalMs = ChatManager.DEFAULT_SWEEP_INTERVAL_MS;

    if (this.sweepRules.length) {
      setInterval(() => this.sweep(), this.taskSweepIntervalMs);
    }
  }

  private multiSort(a: SortTaskHandle, b: SortTaskHandle) {
    return this.sortRules.reduce((acc, rule) => {
      return acc || rule(a, b);
    }, 0);
  }

  private sweep() {
    this.taskHandles = this.taskHandles.filter((t) => {
      const sweepResult = this.sweepRules.map((rule) => rule(t));
      const removal = sweepResult.find((r) => r.shouldRemove);
      if (!removal) return true;

      const reason = removal.reason ?? "(no reason povided)";
      this.logger.warn(`[manager] task removed ${reason}`);
      t.reject(new Error(`task removed ${reason}`));

      if (t.isRunning) {
        // Sweep conducts forced removal. Remove the handle even if it is owned by the worker
        this.workers.forEach((worker) => worker.abort((task) => task === t.task));
      }

      return false;
    });
  }

  private getInitialSweepRules(customRules: ChatManagerConfig["onInitSweepRules"]) {
    const defaultRules: SweepRule[] = [globalTimeout(ChatManager.DEFAULT_GLOBAL_TIMEOUT_MS)];
    return customRules?.(defaultRules) ?? defaultRules;
  }

  private getInitialMatchRules(customRules: ChatManagerConfig["onInitMatchRules"]) {
    const defaultRules: MatchRule[] = [matchByModel(), matchByToken()];
    return customRules?.(defaultRules) ?? defaultRules;
  }

  public async submit(task: IChatTask) {
    return new Promise<any>((resolve, reject) => {
      const taskHandle: TaskHandle = {
        task,
        retryLeft: 3,
        resolve,
        reject,
        createdAt: Date.now(),
      };

      this.announceNewTask(taskHandle);
    });
  }

  public abortAll() {
    // clear all unassigned tasks
    this.taskHandles = this.taskHandles.filter((t) => t.isRunning);

    // abort all assigned tasks
    this.workers.forEach((worker) => worker.abortAll());
  }

  public abort(selectTask: (task: IChatTask) => boolean) {
    // clear selected unassigned tasks
    this.taskHandles = this.taskHandles.filter((t) => t.isRunning || !selectTask(t.task));

    // abort selected assigned tasks
    this.workers.forEach((worker) => worker.abort(selectTask));
  }

  public request(req: IWorkerTaskRequest): IChatTask | null {
    if (!this.taskHandles.length) {
      this.logger.info(`[manager] all tasks completed, stopping workers`);
      this.workers.forEach((worker) => worker.stop());
      return null;
    }

    const pendingTasks = this.taskHandles.filter((t) => !t.isRunning).sort(this.multiSort.bind(this));
    const matchedTask = this.getMatchedTask(req, pendingTasks);

    if (!matchedTask) {
      this.logger.debug(`[manager] no task found from ${pendingTasks.length} pending tasks`);
      return null;
    }

    this.logger.debug(`[manager] task found from ${pendingTasks.length} pending tasks`);
    matchedTask.isRunning = true;
    return matchedTask.task;
  }

  public respond(task: IChatTask, result: IWorkerTaskResponse) {
    const taskHandle = this.taskHandles.find((t) => t.task === task);
    if (!taskHandle) {
      this.logger.warn(`[manager] task handle already removed, no-op`);
      return;
    }

    // remove task handle from list
    taskHandle.isRunning = false;
    this.taskHandles = this.taskHandles.filter((t) => t !== taskHandle);

    if (result.error && !result.shouldRetry) {
      this.logger.info(`[manager] Non-retryable error`, result.error);
      taskHandle.reject(result.error);
    } else if (result.error) {
      taskHandle.retryLeft--;
      if (!taskHandle.retryLeft) {
        this.logger.warn(`[manager] no retry left`);
        taskHandle.reject(result.error);
      } else {
        this.logger.warn(`[manager] task requeued, ${taskHandle.retryLeft} retries left`, result.error);
        // TODO need renew controller
        this.announceNewTask(taskHandle);
      }
    } else {
      taskHandle.resolve(result.data!);
    }

    const runningTasks = this.taskHandles.filter((t) => t.isRunning);
    this.logger.info(`[manager] ${this.taskHandles.length - runningTasks.length} waiting | ${runningTasks.length} running`);
  }

  private announceNewTask(handle: TaskHandle) {
    this.taskHandles.push(handle);
    this.logger.info(`[manager] ${this.taskHandles.length} tasks | ${this.workers.length} workers`);
    this.workers.forEach((worker) => worker.start(this));
  }

  private getMatchedTask(req: IWorkerTaskRequest, availableHandles: TaskHandle[]): TaskHandle | null {
    return (
      availableHandles.find((handle) => {
        return this.matchRules.every((rule) => rule(req, handle.task));
      }) ?? null
    );
  }
}
