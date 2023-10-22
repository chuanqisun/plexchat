import { Subject, filter, map } from "rxjs";

export default {};

export const enum Status {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

export interface TaskHandle {
  id: string;
  status: Status;
  task: any;
}

const task$ = new Subject<TaskHandle>();

task$
  .pipe(
    filter((handle) => handle.status === Status.Pending),
    filter(() => true), // Match available worker)
    map((handle) => ({ ...handle, status: Status.Running })) // update the state of task, then put it back
    // update the state of task, then put it back
  )
  .subscribe(task$);

task$.subscribe(console.log);

task$.next({ id: "123", status: Status.Pending, task: { hello: "world" } });
