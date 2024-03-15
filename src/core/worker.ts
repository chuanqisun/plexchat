import { Observable, Subject, combineLatest, map, tap } from "rxjs";
import type { IWorker, TaskHandle, WorkerTaskEvent } from "./types";

// TODO: apply task execution logic

type ObservableFactory<T> = (...args: any[]) => Observable<T>;
type TypeOfObservableMerge<T extends ObservableFactory<any>[]> = T extends [ObservableFactory<infer U>, ...infer Rest]
  ? Rest extends ObservableFactory<any>[]
    ? Merge<U, TypeOfObservableMerge<Rest>>
    : Rest extends ObservableFactory<infer Q>
    ? Q
    : {}
  : {};
type Merge<A, B> = { [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never };

export function createWorker(options: { policies: ObservableFactory<any>[] }): IWorker {
  const { policies } = options;
  const $consumptionRecords = new Subject<any>();

  const $usage = combineLatest(policies.map((policy) => policy($consumptionRecords))).pipe(
    map((contraints) => Object.fromEntries(contraints.flatMap(Object.entries))),
    tap((usage) => console.log(`[worker] usage`, JSON.stringify(usage)))
  ) as Observable<any>;

  function startTask(task: TaskHandle): Observable<WorkerTaskEvent> {
    // TBD inject logic
    const $task = new Observable<WorkerTaskEvent>((subscriber) => {
      $consumptionRecords.next("resource consumed!");
      subscriber.next({ type: "started", handle: task });
      const cancel1 = setTimeout(() => {
        subscriber.next({ type: "updated", handle: task });
      }, 1000);
      const cancel2 = setTimeout(() => {
        subscriber.next({ type: "completed", handle: task });
        subscriber.complete();
      }, 2000);

      return () => {
        clearTimeout(cancel1);
        clearTimeout(cancel2);
      };
    });
    return $task;
  }

  return {
    startTask,
    $consumptionRecords,
    $usage,
  };
}
