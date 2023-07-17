import { dfsPack } from "./packing";
import { Assignment, RunFn, ScheduleFn, SchedulerState, createTaskManager } from "./scheduler";

const chat = createChat({
  getDemand: (input) => input?.[0].length * 1000,
  workers: [
    {
      id: 1,
      run: async (message) => {
        return new Promise((resolve, reject) => {
          const box = { resolve, reject };
          const method = Math.random() > 0.5 ? "resolve" : "reject";
          setTimeout(() => box[method](`worker 1: ${method} response to ${message.join()}`), Math.random() * 2000);
        });
      },
      capacity: 3000,
      pendingTasks: [],
    },
    {
      id: 2,
      run: async (message) => {
        return new Promise((resolve, reject) => {
          const box = { resolve, reject };
          const method = Math.random() > 0.5 ? "resolve" : "reject";
          setTimeout(() => box[method](`worker 2: ${method} response to ${message.join()}`), Math.random() * 2000);
        });
      },
      capacity: 6000,
      pendingTasks: [],
    },
  ],
});

chat(["xxx"]).then(console.log);
chat(["xxxxx"]).then(console.log);
chat(["xx"]).then(console.log);
chat(["xxxx"]).then(console.log);
chat(["xxxxxx"]).then(console.log);

interface ChatConfig {
  workers: ChatWorker[];
  getDemand: (input: string[]) => number;
}

function createChat({ workers, getDemand }: ChatConfig) {
  let currentJobId = 0;
  const taskManager = createTaskManager<ChatTask, ChatWorker>(getChatScheduler(), getChatRunner());
  taskManager.addWorker(...workers);

  async function chat(input: string[]) {
    return new Promise<string>((resolve) => {
      taskManager.addTask({
        id: ++currentJobId,
        input,
        demand: getDemand(input),
        callback: resolve,
      });
    });
  }

  return chat;
}

export interface ChatTask {
  id: number;
  input: string[];
  demand: number;
  callback: (output: string) => void;
}
export interface ChatWorker {
  id: number;
  run: (input: string[]) => Promise<string>;
  capacity: number;
  pendingTasks: {
    id: number;
    demand: number;
  }[];
}

export function getChatRunner(): RunFn<ChatTask, ChatWorker> {
  return ({ assignment, state, update }) => {
    const { task, worker } = assignment;
    worker.run(task.input).then(
      (result) => {
        // on success, remove task from worker
        update((prev) => ({
          ...prev,
          workers: removeWorkerTask(prev.workers, worker.id, task.id),
        }));
        task.callback(result);
      },
      () => {
        // on error, move task back to queue
        update((prev) => ({
          ...prev,
          tasks: addTaskToQueue(prev.tasks, task),
          workers: removeWorkerTask(prev.workers, worker.id, task.id),
        }));
      }
    );

    // update worker and tasks based on assignment
    const updatedState: SchedulerState<ChatTask, ChatWorker> = {
      workers: addTaskToWorker(state.workers, worker.id, task),
      tasks: removeTaskFromQueue(state.tasks, task.id),
    };

    return { state: updatedState };
  };
}

export function getChatScheduler(): ScheduleFn<ChatTask, ChatWorker> {
  return ({ state }) => {
    const { tasks, workers } = state;
    const mutableWorkers = workers.map((w) => ({
      pendingDemands: w.pendingTasks.map((t) => t.demand),
      original: w,
    }));
    let mutableTasks = [...tasks];

    const assignments: Assignment[] = [];

    for (const mutableWorker of mutableWorkers) {
      if (!mutableTasks.length) break; // stop when no task left

      const affordableTasks = dfsSelectTaskIndices(mutableWorker.original, mutableTasks).map((index) => mutableTasks[index]);
      if (!affordableTasks.length) continue; // next worker when no affordable task

      mutableWorker.pendingDemands.push(...affordableTasks.map((task) => task.demand));
      mutableTasks = mutableTasks.filter((task) => !affordableTasks.includes(task));
      assignments.push(...affordableTasks.map((task) => ({ task, worker: mutableWorker.original })));
    }

    return {
      assignments,
    };
  };
}

function addTaskToWorker(workers: ChatWorker[], workerId: number, task: ChatTask): ChatWorker[] {
  return workers.map((w) => {
    if (w.id !== workerId) return w;
    return {
      ...w,
      pendingTasks: [...w.pendingTasks, { id: task.id, demand: task.demand }],
    };
  });
}

function removeWorkerTask(workers: ChatWorker[], workerId: number, taskId: number): ChatWorker[] {
  return workers.map((w) => {
    if (w.id !== workerId) return w;
    return {
      ...w,
      pendingTasks: w.pendingTasks.filter((block) => block.id !== taskId),
    };
  });
}

function addTaskToQueue(queue: ChatTask[], task: ChatTask): ChatTask[] {
  return [...queue.filter((t) => t.id !== task.id), task];
}

function removeTaskFromQueue(queue: ChatTask[], taskId: number): ChatTask[] {
  return queue.filter((t) => t.id !== taskId);
}

interface CapaticyWorker {
  capacity: number;
}
interface DemandTask {
  demand: number;
}
function dfsSelectTaskIndices<TaskType extends DemandTask, WorkerType extends CapaticyWorker>(worker: WorkerType, tasks: TaskType[]) {
  const pickedIndices = dfsPack(
    worker.capacity,
    tasks.map((task) => task.demand)
  );

  return pickedIndices;
}
