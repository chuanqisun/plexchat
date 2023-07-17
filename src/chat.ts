import { dfsPack } from "./packing";
import { Assignment, RunFn, ScheduleFn, createTaskManager } from "./scheduler";

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

function createChat({ workers, getDemand: estimateDemand }: ChatConfig) {
  let currentJobId = 0;
  const taskManager = createTaskManager<ChatTask, ChatWorker>(getChatScheduler(), getChatRunner());
  taskManager.addWorker(...workers);

  async function chat(input: string[]) {
    return new Promise<string>((resolve) => {
      taskManager.addTask({
        id: ++currentJobId,
        input,
        demand: estimateDemand(input),
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
  return ({ task, worker }, state, update) => {
    // run all assignments
    worker.run(task.input).then(
      (result) => {
        // on success, remove task from worker
        update((prev) => {
          const updatedWorkers = prev.workers.map((w) => {
            if (w.id !== worker.id) return w;
            return {
              ...w,
              pendingTasks: w.pendingTasks.filter((block) => block.id !== task.id),
            };
          });

          return {
            ...prev,
            workers: updatedWorkers,
          };
        });
        task.callback(result);
      },
      () => {
        // on error, move task back to queue
        update((prev) => {
          const updatedWorkers = prev.workers.map((w) => {
            if (w.id !== worker.id) return w;
            return {
              ...w,
              pendingTasks: w.pendingTasks.filter((block) => block.id !== task.id),
            };
          });

          const updatedTasks = [...prev.tasks, task];

          return {
            ...prev,
            tasks: updatedTasks,
            workers: updatedWorkers,
          };
        });
      }
    );

    return state;
  };
}

export function getChatScheduler(): ScheduleFn<ChatTask, ChatWorker> {
  return ({ tasks, workers }) => {
    let updatedTasks = [...tasks];
    let updatedWorkers: ChatWorker[] = [];
    const assignments: Assignment[] = [];

    for (const worker of workers) {
      if (!updatedTasks.length) {
        updatedWorkers.push(worker);
        continue;
      }

      const affordableTasks = dfsSelectTasks(worker, updatedTasks);
      if (!affordableTasks.length) {
        updatedWorkers.push(worker);
        continue;
      }

      const updatedWorker = { ...worker };
      updatedWorker.pendingTasks = affordableTasks.map((task) => ({
        id: task.id,
        demand: task.demand,
      }));
      updatedTasks = updatedTasks.filter((task) => !affordableTasks.includes(task));
      assignments.push(...affordableTasks.map((task) => ({ task, worker })));
      updatedWorkers.push(updatedWorker);
    }

    return {
      assignments,
      state: {
        tasks: updatedTasks,
        workers: updatedWorkers,
      },
    };
  };
}

function dfsSelectTasks(worker: ChatWorker, tasks: ChatTask[]) {
  const pickedIndices = dfsPack(
    worker.capacity,
    tasks.map((task) => task.demand)
  );
  return pickedIndices.map((index) => tasks[index]);
}
