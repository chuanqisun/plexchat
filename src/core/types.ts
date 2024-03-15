import type { Observable, Subject } from "rxjs";

export interface TaskEvent {
  type: "pool:created" | "pool:queued" | "pool:dispatched" | "pool:cancelled" | "worker:started" | "worker:updated" | "worker:completed" | "worker:cancelled";
  handle: TaskHandle;
}

export interface TaskHandle {
  id: number;
  task: any;
}

export interface IWorker<T = {}> {
  startTask: (task: TaskHandle) => Observable<WorkerTaskEvent>;
  $consumptionRecords: Observable<any>;
  $state: Observable<T>;
}

export interface WorkerTaskEvent extends TaskEvent {
  type: "worker:started" | "worker:updated" | "worker:completed" | "worker:cancelled";
}

export interface ITaskPool {
  $taskEvent: Subject<TaskEvent>;
  add: (handle: TaskHandle) => TaskHandle;
  cancel: (handle: TaskHandle) => void;
  cancelAll: () => void;
  create: (task: any) => TaskHandle;
  dispatch: (workerState: any) => TaskHandle | null;
}
