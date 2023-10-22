import { Subject } from "rxjs";
import { filter, map, scan } from "rxjs/operators";

export default {};

export type Action = NewTaskAction | NewWorkerAction | AssignTasksAction;

export type NewTaskAction = {
  type: "newTask";
  id: string;
};

export type NewWorkerAction = {
  type: "newWorker";
  id: string;
};

export type AssignTasksAction = {
  type: "assignTasks";
  assignments: Assignment[];
};

export interface ManagerState {
  pendingTasks: any[];
  workers: Worker[];
}

export interface Task {
  id: string;
}

export interface Worker {
  id: string;
  tasks: Task[];
}

export interface Assignment {
  taskId: string;
  workerId: string;
}

const managerActions$ = new Subject<Action>();

const state$ = managerActions$.pipe(scan(managerStateReducer, { pendingTasks: [], workers: [] }));

const assignments$ = state$.pipe(
  map((state) => {
    // naive assignment
    const assignments: Assignment[] = [];
    const pendingTasks = [...state.pendingTasks];
    const workers = [...state.workers];
    while (pendingTasks.length > 0 && workers.length > 0) {
      const task = pendingTasks.pop();
      const worker = workers.pop();
      if (task && worker) {
        assignments.push({ taskId: task.id, workerId: worker.id });
      }
    }
    return assignments;
  }),
  filter((assignments) => assignments.length > 0)
);

state$.subscribe(console.log);
assignments$.subscribe((assignments) => managerActions$.next({ type: "assignTasks", assignments }));

function managerStateReducer(state: ManagerState, action: Action): ManagerState {
  switch (action.type) {
    case "newWorker": {
      const worker = { id: action.id, tasks: [] };
      return {
        ...state,
        workers: [...state.workers, worker],
      };
    }
    case "newTask": {
      return {
        ...state,
        pendingTasks: [...state.pendingTasks, { id: action.id }],
      };
    }
    case "assignTasks": {
      return {
        ...state,
        workers: state.workers.map((worker) => {
          const assignedTasks: Task[] = action.assignments
            .filter((assignment) => assignment.workerId === worker.id)
            .map((assignment) => ({ id: assignment.taskId }));
          return {
            ...worker,
            tasks: [...worker.tasks, ...assignedTasks],
          };
        }),
        pendingTasks: state.pendingTasks.filter((task) => {
          return !action.assignments.some((assignment) => assignment.taskId === task.id);
        }),
      };
    }
    default:
      return state;
  }
}

managerActions$.next({ type: "newWorker", id: "1" });
managerActions$.next({ type: "newTask", id: "1" });
managerActions$.next({ type: "newTask", id: "2" });
managerActions$.next({ type: "newTask", id: "3" });
managerActions$.next({ type: "newWorker", id: "2" });
managerActions$.next({ type: "newTask", id: "4" });
managerActions$.next({ type: "newTask", id: "5" });

// SubmitEvent => OnSubmit
// OnSubmit => ManagerQueueUpdateEvent
// (ManageQueueUpdateEvent, WorkerQueueUpdateEvent) => OnDispatch
// OnDispatch =?=> (ManagerQueueUpdateEvent, WorkerQueueUpdateEvent)
// WorkerQueueUpdateEvent => OnWorkerQueueUpdate
// OnWorkerQueueUpdate => WorkStartEvent
// WorkStartEvent =(external fn call with result wrapped)=> WorkDoneEvent<OK, Err>
// TimerEvent => WorkerQueueUpdateEvent
// WorkDoneEvent<OK> => (unwrap fn call result)
// WorkDoneEvent<Err> => HandleError
// HandleError => (retry ? WorkerQueueUpdateEvent : unwrap fn call result)
