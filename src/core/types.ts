import type { Observable, Subject } from "rxjs";

export interface TaskEvent {
  type: "created" | "queued" | "dispatched" | "started" | "updated" | "completed" | "cancelled";
  handle: TaskHandle;
}

export interface TaskHandle {
  id: number;
  task: any;
}

export interface IWorker<T = {}> {
  startTask: (task: TaskHandle) => Observable<WorkerTaskEvent>;
  $consumptionRecords: Observable<any>;
  $usage: Observable<T>;
}

export interface WorkerTaskEvent extends TaskEvent {
  type: "started" | "updated" | "completed";
}

export interface ITaskPool {
  $taskEvent: Subject<TaskEvent>;
  add: (handle: TaskHandle) => TaskHandle;
  cancel: (handle: TaskHandle) => void;
  cancelAll: () => void;
  create: (task: any) => TaskHandle;
  dispatch: (usage: any) => TaskHandle | null;
}
