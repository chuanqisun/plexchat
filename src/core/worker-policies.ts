import { Observable, delay, map, merge, scan, startWith } from "rxjs";

export function rpm10s() {
  return function ($consumptionRecords: Observable<any>): Observable<{ reqUsed10s: number }> {
    const $reqUsed10s = $consumptionRecords.pipe(map(() => 1));
    const $reqRecovered10s = $consumptionRecords.pipe(
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
  return function ($consumptionRecords: Observable<any>): Observable<{ reqUsed3s: number }> {
    const $reqUsed3s = $consumptionRecords.pipe(map(() => 1));
    const $reqRecovered3s = $consumptionRecords.pipe(
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
