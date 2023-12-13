import { LogLevel, getLogger, type ILogger } from "./logger";
import type { IChatTask, IChatTaskManager, IChatWorker, IChatWorkerManager, IWorkerTaskRequest, IWorkerTaskResponse } from "./types";

interface TaskHandle {
  task: IChatTask;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  isRunning?: boolean;
  retryLeft: number;
}

export interface ChatManagerConfig {
  workers: IChatWorker[];
  logLevel?: LogLevel;
}
export class ChatManager implements IChatTaskManager, IChatWorkerManager {
  private workers: IChatWorker[];
  private taskHandles: TaskHandle[] = [];
  private logger: ILogger;

  constructor(config: ChatManagerConfig) {
    this.workers = config.workers;
    this.logger = getLogger(config.logLevel);
  }

  public async submit(task: IChatTask) {
    return new Promise<any>((resolve, reject) => {
      const taskHandle: TaskHandle = {
        task,
        retryLeft: 3,
        resolve,
        reject,
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
    // clear all unassigned tasks
    this.taskHandles = this.taskHandles.filter((t) => t.isRunning);

    // abort selected assigned tasks
    this.workers.forEach((worker) => worker.abort(selectTask));
  }

  public request(req: IWorkerTaskRequest): IChatTask | null {
    if (!this.taskHandles.length) {
      this.logger.info(`[manager] all tasks completed, stopping workers`);
      this.workers.forEach((worker) => worker.stop());
      return null;
    }

    const pendingTasks = this.taskHandles.filter((t) => !t.isRunning);
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
      this.logger.error(`[manager] task handle not found`);
      throw new Error("task handle not found");
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
        return (
          // model matched
          handle.task.models.some((demandedModel) => req.models.includes(demandedModel)) &&
          // token limit matched
          handle.task.tokenDemand <= req.tokenCapacity
        );
      }) ?? null
    );
  }
}
