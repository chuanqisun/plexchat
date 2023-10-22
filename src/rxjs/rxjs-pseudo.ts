import { Subject, filter, mergeMap, tap } from "rxjs";

export default {};

export interface TaskHandle {
  id: string;
  task: any;
  result?: any;
}

const task$ = new Subject<TaskHandle>();

task$
  .pipe(
    mergeMap((handle) => new Promise<TaskHandle>((resolve) => resolve({ ...handle, result: Math.random() }))),
    tap(console.log),
    filter((handle) => handle.result <= 0.9) // similate 90% error rate
  )
  .subscribe(task$);

task$.next({ id: "1", task: "task1" });
