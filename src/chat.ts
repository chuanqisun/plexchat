import { dfsPack } from "./packing";
import { Assignment, RunFn, ScheduleFn, SchedulerState, createTaskManager } from "./scheduler";
import { ChatInput, ChatOutput } from "./types";

export function simpleChat(workerChat: WorkerChat, models: string[], input: SimpleChatInput): Promise<ChatOutput> {
  const fullInput = getInput(input);
  const fullDemand = getDemand(models, fullInput);
  return workerChat(fullInput, fullDemand);
}

export interface WorkerChatConfig {
  workers: ChatWorker[];
  onNextTick?: (task: () => any) => void;
}

export type WorkerChat = (input: ChatInput, demand: ChatTaskDemand) => Promise<ChatOutput>;

export function createWorkerChat({ workers }: WorkerChatConfig): WorkerChat {
  let currentJobId = 0;
  let isTicking = false;
  const taskManager = createTaskManager<ChatTask, ChatWorker>(getChatScheduler(), getChatRunner({ demandExpireAfterMs: 65_000 }));
  taskManager.addWorker(...workers);

  const startClock = () => {
    if (isTicking) return;
    isTicking = true;
    setTimeout(gc);
  };

  function gc() {
    const now = Date.now();

    taskManager.update((prev) => ({
      ...prev,
      workers: removeWorkerExpiredTasks(prev.workers, now),
    }));

    console.log(
      taskManager
        .getWorkers()
        .map((w) => `${w.id}: ${w.historyTasks.length}`)
        .join(" | ")
    );

    if (taskManager.getTasks().length) {
      setTimeout(gc);
    } else {
      isTicking = false;
    }
  }

  const chat: WorkerChat = async (input: ChatInput, demand: ChatTaskDemand) => {
    startClock();
    return new Promise<ChatOutput>((resolve) => {
      taskManager.addTask({
        id: ++currentJobId,
        input,
        demand,
        callback: resolve,
      });
    });
  };

  return chat;
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
export function getDemand(models: string[], input: DemandChatInput): ChatTaskDemand {
  return {
    acceptModels: models,
    outputTokens: input.max_tokens,
    inputTokens: input.messages.flatMap((msg) => msg.content.split(" ")).length,
  };
}

export interface ChatTask {
  id: number;
  input: ChatInput;
  demand: ChatTaskDemand;
  callback: (output: ChatOutput) => void;
}
export interface ChatWorker {
  id: number;
  run: (input: ChatInput) => Promise<ChatOutput>;
  spec: ChatWorkerSpec;
  historyTasks: {
    id: number;
    expireAt: number;
    demand: ChatTaskDemand;
  }[];
}

export interface ChatWorkerSpec {
  models: string[];
  tokensPerMinute: number;
}

export interface ChatTaskDemand {
  acceptModels: string[];
  outputTokens: number;
  inputTokens: number;
}

export function getChatScheduler(): ScheduleFn<ChatTask, ChatWorker> {
  return ({ state }) => {
    const { tasks, workers } = state;
    const mutableWorkers = workers.map((w) => ({
      historyDemands: w.historyTasks.map((t) => t.demand),
      original: w,
    }));
    let mutableTasks = [...tasks];

    const assignments: Assignment[] = [];

    for (const mutableWorker of mutableWorkers) {
      if (!mutableTasks.length) break; // stop when no task left

      const affordableTasks = dfsSelectTaskIndices(mutableWorker.original, mutableTasks).map((index) => mutableTasks[index]);
      if (!affordableTasks.length) continue; // next worker when no affordable task

      mutableWorker.historyDemands.push(...affordableTasks.map((task) => task.demand));
      mutableTasks = mutableTasks.filter((task) => !affordableTasks.includes(task));
      assignments.push(...affordableTasks.map((task) => ({ task, worker: mutableWorker.original })));
    }

    return {
      assignments,
    };
  };
}

export interface ChatRunnerConfig {
  demandExpireAfterMs: number;
}
export function getChatRunner(config: ChatRunnerConfig): RunFn<ChatTask, ChatWorker> {
  return ({ assignment, state, update }) => {
    const { task, worker } = assignment;
    worker.run(task.input).then(task.callback, () => {
      // on error, requeue the task
      update((prev) => ({
        ...prev,
        tasks: addTaskToQueue(prev.tasks, task),
      }));
    });

    // update worker and tasks based on assignment
    const updatedState: SchedulerState<ChatTask, ChatWorker> = {
      workers: addTaskToWorker(state.workers, worker.id, task, Date.now() + config.demandExpireAfterMs),
      tasks: removeTaskFromQueue(state.tasks, task.id),
    };

    return { state: updatedState };
  };
}

function addTaskToWorker(workers: ChatWorker[], workerId: number, task: ChatTask, expireAt: number): ChatWorker[] {
  return workers.map((w) => {
    if (w.id !== workerId) return w;
    return {
      ...w,
      historyTasks: [...w.historyTasks, { id: task.id, demand: task.demand, expireAt }],
    };
  });
}

function addTaskToQueue(queue: ChatTask[], task: ChatTask): ChatTask[] {
  return [...queue.filter((t) => t.id !== task.id), task];
}

function removeTaskFromQueue(queue: ChatTask[], taskId: number): ChatTask[] {
  return queue.filter((t) => t.id !== taskId);
}

function removeWorkerExpiredTasks(workers: ChatWorker[], now: number): ChatWorker[] {
  return workers.map((w) => ({
    ...w,
    historyTasks: w.historyTasks.filter((t) => t.expireAt > now),
  }));
}

function dfsSelectTaskIndices(worker: ChatWorker, tasks: ChatTask[]) {
  const capacity = worker.spec.tokensPerMinute - worker.historyTasks.reduce((acc, task) => acc + task.demand.inputTokens, 0);

  const pickedIndices = dfsPack(
    capacity,
    tasks.map((task) => task.demand.inputTokens + task.demand.outputTokens)
  );

  return pickedIndices;
}
