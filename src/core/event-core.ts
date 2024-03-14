import { Observable, Subject, Subscription, filter, interval, map, merge, mergeMap, takeUntil, tap } from "rxjs";

interface TaskChange {
  type: "added" | "started" | "updated" | "completed" | "cancelled";
  handle: TaskHandle;
}

interface TaskHandle {
  id: number;
  task: any;
}

interface WorkerConfig {
  run(task: any, onCapacityEvent: (capacityEvent: any) => any): Observable<TaskChange>; // TODO hide system types
  onCapacityScan($capacityEvent: Observable<any>): Observable<any>; // TODO non-numeric capacity
  onCapacityEventExpire(capacityEvent: any): boolean; // TODO GC out of date capacity records
}

function createScheduler() {
  const $heartbeat = interval(1000);
  const $taskUpdates = new Subject<TaskChange>();
  const $taskAnnouncement = $taskUpdates.pipe(
    filter((change) => change.type === "added"),
    map((change) => change.handle.task)
  );

  const $taskCancellation = $taskUpdates.pipe(
    filter((change) => change.type === "cancelled"),
    map((change) => change.handle)
  );

  let taskId = 0;
  const taskPool = new Map<number, TaskHandle>();

  function submit(task: any): Observable<TaskChange> {
    return new Observable((subscriber) => {
      start();

      const id = taskId++;
      const subscription = $taskUpdates.pipe(filter((taskChange) => taskChange.handle.id === id)).subscribe(subscriber);
      const handle: TaskHandle = { id, task };
      taskPool.set(id, handle);
      $taskUpdates.next({ type: "added", handle });

      return () => {
        console.log(`[scheduler] task cancelled`);
        taskPool.delete(id);
        $taskUpdates.next({ type: "cancelled", handle });
        subscription.unsubscribe();
      };
    });
  }

  function requestTask(capacity: any): TaskHandle | null {
    // naive scheduling
    const next = taskPool.values().next();
    if (next.value) {
      taskPool.delete((next.value as TaskHandle).id);
      return next.value;
    } else {
      return null;
    }
  }

  function retryTask(task: TaskHandle) {
    taskPool.set(task.id, task);
    $taskUpdates.next({ type: "added", handle: task });
  }

  function addWorker(config?: WorkerConfig) {
    const $heartbeat = interval(1000); // TODO replace with time based capacity change

    const $capacityChange = new Subject<any>();
    const $capacity = $capacityChange.pipe();

    return merge($taskAnnouncement, $capacityChange, $heartbeat).pipe(
      map(() => requestTask(1)),
      filter(isNotNull),
      mergeMap((handle) => {
        const $cancelSignal = $taskCancellation.pipe(filter((cancelTask) => cancelTask.id === handle.id));

        const $taskV2 = config?.run(handle.task, (capacityChange) => $capacityChange.next(capacityChange));

        const $task = new Observable<TaskChange>((subscriber) => {
          $capacityChange.next("capacity reduced");
          subscriber.next({ type: "started", handle });
          const cancel1 = setTimeout(() => {
            subscriber.next({ type: "updated", handle });
          }, 1000);
          const cancel2 = setTimeout(() => {
            subscriber.next({ type: "completed", handle });
            subscriber.complete();
            $capacityChange.next("capacity increased");
          }, 2000);

          return () => {
            console.log(`[scheduler] task stopped`);
            clearTimeout(cancel1);
            clearTimeout(cancel2);
          };
        });

        return $task.pipe(takeUntil($cancelSignal));
      }),
      tap((taskChange) => $taskUpdates.next(taskChange))
    );
  }

  let schedulerSubscription: Subscription | null;

  function start() {
    console.log(`[scheduler] started`);
    if (schedulerSubscription) return;
    schedulerSubscription = merge($taskUpdates, $heartbeat).subscribe();
  }

  function stop() {
    schedulerSubscription?.unsubscribe();
    schedulerSubscription = null;
    console.log(`[scheduler] stopped`);
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

const { stop, submit, addWorker } = createScheduler();

const worker1 = addWorker();
const worker2 = addWorker();
const work1Subscription = worker1.subscribe((we) => console.log(`[worker 1]`, JSON.stringify(we)));
const work2Subscription = worker2.subscribe((we) => console.log(`[worker 2]`, JSON.stringify(we)));

const task1Sub = submit("task 1").subscribe();
const task2Sub = submit("task 2").subscribe();

// simulate abortion
setTimeout(() => task1Sub.unsubscribe(), 500);

setTimeout(() => {
  stop();
  work1Subscription.unsubscribe();
  work2Subscription.unsubscribe();
}, 5000);
