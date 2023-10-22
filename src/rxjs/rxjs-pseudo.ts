import { Subject } from "rxjs";

export default {};

interface TaskHandle {
  id: string;
  data: any;
}

interface WorkerHandle {
  id: string;
  tasks: TaskHandle[];
}

interface SchedulerState {
  taskPool: TaskHandle[];
  workerPool: WorkerHandle[];
}

const state$ = new Subject<SchedulerState>();
