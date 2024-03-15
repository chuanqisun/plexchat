import { Observable, Subject, combineLatest, map, tap } from "rxjs";
import type { IWorker, TaskHandle, WorkerTaskEvent } from "./types";

// TODO: apply task execution logic
// TODO: what if policy contains dispatch logic? i.e. policy represents worker state
// TODO: migrate consumption records to use workerTaskEvents

export type ObservableFactory<T> = (input: { $consumptionRecords: Observable<WorkerTaskEvent> }) => Observable<T>;

export function createWorker(options: { policies: ObservableFactory<any>[] }): IWorker {
  const { policies } = options;
  const $consumptionRecords = new Subject<WorkerTaskEvent>();

  const $state = combineLatest(policies.map((policy) => policy({ $consumptionRecords }))).pipe(
    map((contraints) => Object.fromEntries(contraints.flatMap(Object.entries))),
    tap((state) => console.log(`[worker] state`, JSON.stringify(state)))
  ) as Observable<any>;

  function startTask(task: TaskHandle): Observable<WorkerTaskEvent> {
    // TBD inject logic
    const $task = new Observable<WorkerTaskEvent>((subscriber) => {
      let ranToFinish = false;

      subscriber.next({ type: "worker:started", handle: task });
      const cancel1 = setTimeout(() => {
        subscriber.next({ type: "worker:updated", handle: task });
      }, 1000);
      const cancel2 = setTimeout(() => {
        ranToFinish = true;
        subscriber.next({ type: "worker:completed", handle: task });
        subscriber.complete();
      }, 2000);

      return () => {
        if (!ranToFinish) {
          // in teardown, we must directly emit to target subject or the event will never reach the subscriber
          $consumptionRecords.next({ type: "worker:cancelled", handle: task });
          clearTimeout(cancel1);
          clearTimeout(cancel2);
        }
      };
    });
    return $task.pipe(tap((event) => $consumptionRecords.next(event)));
  }

  return {
    startTask,
    $consumptionRecords,
    $state,
  };
}
