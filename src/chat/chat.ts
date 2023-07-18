import { fifoPack } from "../scheduler/packing";
import { createTaskManager, type Assignment, type RunFn, type ScheduleFn, type SchedulerState } from "../scheduler/scheduler";
import type { ChatInput, ChatOutput, ModelName } from "./types";

export interface ChatSchedulerConfig {
  workers: ChatWorker[];
  verbose?: boolean;
}

export type ChatTaskRunner = (task: ChatTask) => void;

export function getChatTaskRunner(config: ChatSchedulerConfig): ChatTaskRunner {
  const { workers, verbose = false } = config;
  let isTicking = false;

  const taskManager = createTaskManager<ChatTask, ChatWorker>(getChatScheduler(), getChatRunner());
  taskManager.addWorker(...workers);

  const startGC = () => {
    if (isTicking) return;
    isTicking = true;
    gc();
  };

  function gc() {
    const now = Date.now();

    taskManager.update((prev) => ({
      ...prev,
      workers: removeWorkerExpiredTasks(prev.workers, now),
    }));

    if (verbose) {
      console.log(
        taskManager
          .getWorkers()
          .map((w) => `${w.id}: ${w.historyTasks.length}`)
          .join(" | ")
      );
    }

    console.log({ tasks: taskManager.getTasks(), workers: taskManager.getWorkers() });

    if (taskManager.getTasks().length) {
      setTimeout(gc, 1000);
    } else {
      isTicking = false;
    }
  }

  const runChatTask: ChatTaskRunner = async (chatTask: ChatTask) => {
    taskManager.addTask(chatTask);
    startGC();
  };

  return runChatTask;
}

export type SimpleChatInput = Partial<ChatInput> & Pick<ChatInput, "messages">;
export function getInput(input: SimpleChatInput): ChatInput {
  return {
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 60,
    stop: "",
    ...input,
  };
}

export type DemandChatInput = Partial<ChatInput> & Pick<ChatInput, "messages" | "max_tokens">;
export function getEstimatedDemand(models: ModelName[], input: DemandChatInput): ChatTaskDemand {
  return {
    models: models,
    totalTokens: input.max_tokens + input.messages.flatMap((msg) => msg.content.split(" ")).length * 1.5,
  };
}

export interface ChatTask {
  id: string;
  input: ChatInput;
  demand: ChatTaskDemand;
  retryLeft: number;
  onSuccess: (output: ChatOutput) => void;
  onError: (error: any) => void;
}
export interface ChatWorker {
  id: string;
  proxy: OpenAIJsonProxy;
  spec: ChatWorkerSpec;
  historyTasks: {
    id: string;
    expireAt: number;
    tokenConsumed: number;
    isRunning?: boolean;
  }[];
}
export type OpenAIJsonProxy = (input: ChatInput) => Promise<ChatOutput>;

export interface ChatWorkerSpec {
  models: ModelName[];
  parallelism: number;
  tokenLimit: number;
  tokenLimitWindowSize: number;
}

export interface ChatTaskDemand {
  models: ModelName[];
  totalTokens: number;
}

export function getChatScheduler(): ScheduleFn<ChatTask, ChatWorker> {
  return ({ state }) => {
    const { tasks, workers } = state;
    const mutableWorkers = workers.map((w) => ({
      historyDemands: w.historyTasks.map((t) => t.tokenConsumed),
      runningTaskCount: w.historyTasks.filter((t) => t.isRunning).length,
      original: w,
    }));
    let mutableTasks = [...tasks];

    const assignments: Assignment[] = [];

    for (const mutableWorker of mutableWorkers) {
      if (!mutableTasks.length) break; // stop when no task left

      const availableParallelism = mutableWorker.original.spec.parallelism - mutableWorker.runningTaskCount;

      const affordableTasks = selectTaskIndices(mutableWorker.original, mutableTasks).map((index) => mutableTasks[index]);

      const parallelControlledTasks = affordableTasks.slice(0, availableParallelism);
      if (!parallelControlledTasks.length) continue; // next worker when no affordable task

      mutableWorker.historyDemands.push(...parallelControlledTasks.map((task) => task.demand.totalTokens));
      mutableTasks = mutableTasks.filter((task) => !parallelControlledTasks.includes(task));
      assignments.push(...parallelControlledTasks.map((task) => ({ task, worker: mutableWorker.original })));
    }

    return {
      assignments,
    };
  };
}

export function getChatRunner(): RunFn<ChatTask, ChatWorker> {
  return ({ assignment, state, update }) => {
    const { task, worker } = assignment;
    worker.proxy(task.input).then(
      (result) => {
        task.onSuccess(result);
        update((prev) => ({
          ...prev,
          workers: markRunningTaskAsStopped(prev.workers, worker.id, task.id),
        }));
      },
      (err) => {
        // on error, requeue the task
        if (task.retryLeft <= 0) {
          console.log("no retry left", err);
          task.onError(err);
        } else {
          console.log("requeued on error", err);
          update((prev) => ({
            ...prev,
            tasks: addTaskToQueue(prev.tasks, { ...task, retryLeft: task.retryLeft - 1 }),
          }));
        }
      }
    );

    // update worker and tasks based on assignment
    const updatedState: SchedulerState<ChatTask, ChatWorker> = {
      workers: addRunningTaskToWorker(state.workers, worker.id, task, Date.now() + worker.spec.tokenLimitWindowSize),
      tasks: removeTaskFromQueue(state.tasks, task.id),
    };

    return { state: updatedState };
  };
}

function addRunningTaskToWorker(workers: ChatWorker[], workerId: string, task: ChatTask, expireAt: number): ChatWorker[] {
  return workers.map((w) => {
    if (w.id !== workerId) return w;
    return {
      ...w,
      historyTasks: [...w.historyTasks, { id: task.id, tokenConsumed: task.demand.totalTokens, expireAt, isRunning: true }],
    };
  });
}

function markRunningTaskAsStopped(workers: ChatWorker[], workerId: string, taskId: string): ChatWorker[] {
  return workers.map((w) => {
    if (w.id !== workerId) return w;
    return {
      ...w,
      historyTasks: w.historyTasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          isRunning: false,
        };
      }),
    };
  });
}

function addTaskToQueue(queue: ChatTask[], task: ChatTask): ChatTask[] {
  return [...queue.filter((t) => t.id !== task.id), task];
}

function removeTaskFromQueue(queue: ChatTask[], taskId: string): ChatTask[] {
  return queue.filter((t) => t.id !== taskId);
}

function removeWorkerExpiredTasks(workers: ChatWorker[], now: number): ChatWorker[] {
  return workers.map((w) => ({
    ...w,
    historyTasks: w.historyTasks.filter((t) => t.expireAt > now),
  }));
}

function selectTaskIndices(worker: ChatWorker, tasks: ChatTask[]) {
  const capacity = worker.spec.tokenLimit - worker.historyTasks.reduce((acc, task) => acc + task.tokenConsumed, 0);

  const pickedIndices = fifoPack(
    capacity,
    tasks.map((task) => task.demand.totalTokens)
  );

  return pickedIndices;
}
