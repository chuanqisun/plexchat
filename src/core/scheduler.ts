import { Observable, Subscription, combineLatest, filter, from, interval, map, merge, mergeMap, takeUntil, tap } from "rxjs";
import type { ITaskPool, IWorker, TaskEvent } from "./types";

export function createScheduler<T>(options: { pool: ITaskPool; workers?: IWorker[] }) {
  const $heartbeat = interval(1000);
  const taskPool = options.pool;

  const $taskAnnouncement = taskPool.$taskEvent.pipe(
    filter((event) => event.type === "queued"),
    map((event) => event.handle.task)
  );

  const $taskCancellation = taskPool.$taskEvent.pipe(
    filter((event) => event.type === "cancelled"),
    map((event) => event.handle)
  );

  function submit(task: any): Observable<TaskEvent> {
    return new Observable((subscriber) => {
      start();

      const handle = taskPool.create(task);
      const subscription = taskPool.$taskEvent.pipe(filter((taskEvent) => taskEvent.handle.id === handle.id)).subscribe(subscriber);
      taskPool.add(handle);

      return () => {
        taskPool.cancel(handle);
        subscription.unsubscribe();
      };
    });
  }

  let schedulerSubscription: Subscription | null;

  function start() {
    console.log(`[scheduler] started`);
    if (schedulerSubscription) return;

    const $managedWorkerStream = from(options.workers ?? []).pipe(mergeMap(addWorker));
    schedulerSubscription = merge(taskPool.$taskEvent, $managedWorkerStream, $heartbeat).subscribe();
  }

  function stop() {
    taskPool.cancelAll();
    schedulerSubscription?.unsubscribe();
    schedulerSubscription = null;
    console.log(`[scheduler] stopped`);
  }

  function addWorker(worker: IWorker) {
    return combineLatest([$taskAnnouncement, worker.$usage]).pipe(
      map(([_annoucement, usage]) => taskPool.dispatch(usage)),
      filter(isNotNull),
      mergeMap((handle) => {
        const $cancelSignal = $taskCancellation.pipe(filter((cancelTask) => cancelTask.id === handle.id));
        const $task = worker.startTask(handle);
        return $task.pipe(takeUntil($cancelSignal));
      }),
      tap((taskEvent) => taskPool.$taskEvent.next(taskEvent))
    );
  }

  function isNotNull<T>(value: T | null): value is T {
    return value !== null;
  }

  return {
    addWorker,
    submit,
    stop,
  };
}
