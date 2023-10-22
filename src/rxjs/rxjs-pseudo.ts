import { randomUUID } from "crypto";
import { Subject, filter, first, map, mergeMap } from "rxjs";

export default {};

export interface TaskHandle {
  id: string;
  task: any;
  result?: any;
}

const task$ = new Subject<TaskHandle>();

task$.subscribe(console.log);

// success stream
task$
  .pipe(
    filter((handle) => !handle.result),
    mergeMap((handle) => new Promise<TaskHandle>((resolve) => resolve({ ...handle, result: Math.random() })))
  )
  .subscribe(task$);

// retry stream
task$
  .pipe(
    filter((handle) => handle.result && handle.result < 0.5),
    map((handle) => ({ ...handle, result: undefined })) // retry
  )
  .subscribe(task$);

async function submit(task: any) {
  const newHandle = { id: randomUUID(), task };
  const resultAsync = new Promise((resolve, reject) =>
    task$
      .pipe(
        filter((completeHandle) => completeHandle.id === newHandle.id && completeHandle.result >= 0.5),
        first()
      )
      .subscribe({
        next: resolve,
        error: reject,
      })
  );

  task$.next(newHandle);

  return resultAsync;
}

async function main() {
  const final = await Promise.all([submit("task 1"), submit("task 2"), submit("task 3")]);
  console.log("final", JSON.stringify(final, null, 2));
}

main();
