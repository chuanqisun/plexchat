// TODO: generalize usage metrics

import { Observable, Subject, combineLatest, delay, map, merge, scan, startWith } from "rxjs";
import type { TaskHandle, Worker, WorkerTaskEvent } from "./types";

// TODO: apply task execution logic
export function createWorker(): Worker {
  const $consumptionRecords = new Subject<any>();

  const $reqUsed1s = $consumptionRecords.pipe(map(() => 1));
  const $reqRecovered1s = $consumptionRecords.pipe(
    delay(3_000),
    map(() => -1)
  );
  const $reqBalance3s = merge($reqUsed1s, $reqRecovered1s).pipe(scan((acc, value) => [...acc, value], [] as number[]));

  const $reqUsed10s = $consumptionRecords.pipe(map(() => 1));
  const $reqRecovered10s = $consumptionRecords.pipe(
    delay(10_000),
    map(() => -1)
  );
  const $reqBalance10s = merge($reqUsed10s, $reqRecovered10s).pipe(scan((acc, value) => [...acc, value], [] as number[]));

  const sum = (acc: number, value: number) => acc + value;

  const $usageMetric1 = $reqBalance10s.pipe(
    map((count) => ({ reqUsed10s: count.reduce(sum, 0) })),
    startWith({ reqUsed10s: 0 })
  );

  const $usageMetric2 = $reqBalance3s.pipe(
    map((count) => ({ reqUsed3s: count.reduce(sum, 0) })),
    startWith({ reqUsed3s: 0 })
  );

  const allUsageMetrics = [$usageMetric2, $usageMetric1];

  const $usage = combineLatest(allUsageMetrics).pipe(map((contraints) => Object.fromEntries(contraints.flatMap(Object.entries))));

  function startTask(task: TaskHandle): Observable<WorkerTaskEvent> {
    // TBD inject logic
    const $task = new Observable<WorkerTaskEvent>((subscriber) => {
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
