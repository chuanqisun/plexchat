import { Observable, delay, filter, map, merge, scan, startWith } from "rxjs";
import type { WorkerTaskEvent } from "./types";

export function rpm10s() {
  return function (input: { $consumptionRecords: Observable<WorkerTaskEvent> }): Observable<{ reqUsed10s: number }> {
    const { $consumptionRecords } = input;
    const $reqUsed10s = $consumptionRecords.pipe(
      filter((e) => e.type === "worker:started"),
      map(() => 1)
    );
    const $reqRecovered10s = $consumptionRecords.pipe(
      filter((e) => e.type === "worker:completed" || e.type === "worker:cancelled"),
      delay(10_000),
      map(() => -1)
    );
    const $reqBalance10s = merge($reqUsed10s, $reqRecovered10s).pipe(scan((acc, value) => [...acc, value], [] as number[]));

    const sum = (acc: number, value: number) => acc + value;

    const $usageMetric = $reqBalance10s.pipe(
      map((count) => ({ reqUsed10s: count.reduce(sum, 0) })),
      startWith({ reqUsed10s: 0 })
    );

    return $usageMetric;
  };
}

export function rpm3s() {
  return function (input: { $consumptionRecords: Observable<WorkerTaskEvent> }): Observable<{ reqUsed3s: number }> {
    const { $consumptionRecords } = input;
    const $reqUsed3s = $consumptionRecords.pipe(
      filter((e) => e.type === "worker:started"),
      map(() => 1)
    );
    const $reqRecovered3s = $consumptionRecords.pipe(
      filter((e) => e.type === "worker:completed" || e.type === "worker:cancelled"),
      delay(3_000),
      map(() => -1)
    );
    const $reqBalance3s = merge($reqUsed3s, $reqRecovered3s).pipe(scan((acc, value) => [...acc, value], [] as number[]));

    const sum = (acc: number, value: number) => acc + value;

    const $usageMetric2 = $reqBalance3s.pipe(
      map((count) => ({ reqUsed3s: count.reduce(sum, 0) })),
      startWith({ reqUsed3s: 0 })
    );

    return $usageMetric2;
  };
}
