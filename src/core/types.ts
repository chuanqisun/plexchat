import type { Observable, Subject } from "rxjs";

export interface TaskEvent {
  type: "added" | "started" | "updated" | "completed" | "cancelled";
  handle: TaskHandle;
}

export interface WorkerTaskEvent extends TaskEvent {
  type: "updated" | "completed";
}

export interface TaskHandle {
  id: number;
  task: any;
}

export interface Worker {
  startTask: (task: TaskHandle) => Observable<TaskEvent>;
  $consumptionRecords: Observable<any>;
  $usage: Observable<any>;
}

export interface TaskPool {
  $taskEvent: Subject<TaskEvent>;
  add: (handle: TaskHandle) => TaskHandle;
  cancel: (handle: TaskHandle) => void;
  cancelAll: () => void;
  create: (task: any) => TaskHandle;
  dispatch: (usage: any) => TaskHandle | null;
}
