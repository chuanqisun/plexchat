import { createStore } from "./store";

export interface SchedulerState<TaskType = any, WorkerType = any> {
  tasks: TaskType[];
  workers: WorkerType[];
}
export type RunFn<TaskType = any, WorkerType = any> = (
  assignment: Assignment<TaskType, WorkerType>,
  state: SchedulerState<TaskType, WorkerType>,
  update: StateUpdateFn<TaskType, WorkerType>
) => SchedulerState<TaskType, WorkerType>;
export type StateUpdateFn<TaskType = any, WorkerType = any> = (
  fn: (prev: SchedulerState<TaskType, WorkerType>) => SchedulerState<TaskType, WorkerType>
) => void;

export type ScheduleFn<TaskType = any, WorkerType = any> = (state: SchedulerState<TaskType, WorkerType>) => ScheduleOutput<TaskType, WorkerType>;

export interface ScheduleOutput<TaskType = any, WorkerType = any> {
  assignments: Assignment<TaskType, WorkerType>[];
  state: SchedulerState<TaskType, WorkerType>;
}

export interface Assignment<TaskType = any, WorkerType = any> {
  task: TaskType;
  worker: WorkerType;
}

export interface TaskManager<TaskType, WorkerType> {
  addTask: (...task: TaskType[]) => void;
  addWorker: (...worker: WorkerType[]) => void;
}

export function createTaskManager<TaskType, WorkerType>(
  scheduleFn: ScheduleFn<TaskType, WorkerType>,
  runFn: RunFn<TaskType, WorkerType>,
  initialState?: SchedulerState<TaskType, WorkerType>
): TaskManager<TaskType, WorkerType> {
  const store = createStore<SchedulerState<TaskType, WorkerType>>([
    {
      onInit: () => ({
        tasks: [],
        workers: [],
        ...initialState,
      }),
    },
    {
      onTransformChange: ({ current, update }) => {
        const { state, assignments } = scheduleFn(current);
        const newState = assignments.reduce((state, assignment) => {
          return runFn(assignment, state, update);
        }, state);

        return newState;
      },
    },
  ]);

  const addTask = (...task: TaskType[]) => {
    store.update((prev) => {
      prev.tasks.push(...task);
      return prev;
    });
  };

  const addWorker = (...worker: WorkerType[]) => {
    store.update((prev) => {
      prev.workers.push(...worker);
      return prev;
    });
  };

  return {
    addTask,
    addWorker,
  };
}
