import { Observable, Subject, Subscription, combineLatest, delay, filter, interval, map, merge, mergeMap, scan, startWith, take, takeUntil, tap } from "rxjs";

interface TaskEvent {
  type: "added" | "started" | "updated" | "completed" | "cancelled";
  handle: TaskHandle;
}

interface TaskHandle {
  id: number;
  task: any;
}

interface WorkerConfig {
  run(task: any, onCapacityEvent: (capacityEvent: any) => any): Observable<TaskEvent>; // TODO hide system types
  onCapacityScan($capacityEvent: Observable<any>): Observable<any>; // TODO non-numeric capacity
  onCapacityEventExpire(capacityEvent: any): boolean; // TODO GC out of date capacity records
}

export function createScheduler() {
  const $heartbeat = interval(1000);
  const $taskEvent = new Subject<TaskEvent>();
  const $taskAnnouncement = $taskEvent.pipe(
    filter((event) => event.type === "added"),
    map((event) => event.handle.task)
  );

  const $taskCancellation = $taskEvent.pipe(
    filter((event) => event.type === "cancelled"),
    map((event) => event.handle)
  );

  let taskId = 0;
  const taskPool = new Map<number, TaskHandle>();

  function submit(task: any): Observable<TaskEvent> {
    return new Observable((subscriber) => {
      start();

      const id = taskId++;
      const subscription = $taskEvent.pipe(filter((taskEvent) => taskEvent.handle.id === id)).subscribe(subscriber);
      const handle: TaskHandle = { id, task };
      taskPool.set(id, handle);
      $taskEvent.next({ type: "added", handle });

      return () => {
        console.log(`[scheduler] task cancelled`);
        taskPool.delete(id);
        $taskEvent.next({ type: "cancelled", handle });
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
    $taskEvent.next({ type: "added", handle: task });
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

        const $task = new Observable<TaskEvent>((subscriber) => {
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
      tap((taskEvent) => $taskEvent.next(taskEvent))
    );
  }

  let schedulerSubscription: Subscription | null;

  function start() {
    console.log(`[scheduler] started`);
    if (schedulerSubscription) return;
    schedulerSubscription = merge($taskEvent, $heartbeat).subscribe();
  }

  function stop() {
    schedulerSubscription?.unsubscribe();
    schedulerSubscription = null;
    console.log(`[scheduler] stopped`);
  }

  function addWorkerV2(worker: Worker) {
    return worker.$usage.pipe(
      map((usage) => requestTask(usage)),
      filter(isNotNull),
      mergeMap((handle) => {
        const $cancelSignal = $taskCancellation.pipe(filter((cancelTask) => cancelTask.id === handle.id));
        const $task = worker.startTask(handle.task);
        return $task.pipe(takeUntil($cancelSignal));
      }),
      tap((taskEvent) => $taskEvent.next(taskEvent))
    );
  }

  return {
    addWorker,
    addWorkerV2,
    requestTask,
    submit,
    stop,
  };
}

const { stop, submit, addWorker, addWorkerV2, requestTask } = createScheduler();

// const worker1 = addWorker();
// const worker2 = addWorker();
// const work1Subscription = worker1.subscribe((we) => console.log(`[worker 1]`, JSON.stringify(we)));
// const work2Subscription = worker2.subscribe((we) => console.log(`[worker 2]`, JSON.stringify(we)));

// const task1Sub = submit("task 1").subscribe();
// const task2Sub = submit("task 2").subscribe();

// // simulate abortion
// setTimeout(() => task1Sub.unsubscribe(), 500);

// setTimeout(() => {
//   stop();
//   work1Subscription.unsubscribe();
//   work2Subscription.unsubscribe();
// }, 5000);

interface WorkerEvent {
  type: "taskAquired" | "taskChanged" | "taskCompleted";
  handle: TaskHandle;
}

interface Worker {
  startTask: (task: TaskHandle) => Observable<any>;
  $consumptionRecords: Observable<any>;
  $usage: Observable<any>;
  $taskEvents: Observable<any>;
}

// TODO: generalize usage metrics
// TODO: apply task execution logic
function createWorker() {
  const $taskEvents = new Subject<WorkerEvent>();
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

  function startTask(task: any): Observable<any> {
    // TBD inject logic
    return new Observable();
  }

  return {
    startTask,
    $consumptionRecords,
    $usage,
    $taskEvents,
  };
}

const worker = createWorker();
worker.$usage.subscribe((cap) => console.log(`[cap]`, JSON.stringify(cap)));
setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 100);
setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 200);
setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 1500);
setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 1600);

const heartbeat = interval(1000).pipe(take(5)).subscribe();
// 5 sec to kill

// proposed protocol, to be wrapped in the scheduler?
const liveWorker = createWorker();
liveWorker.$usage.pipe(
  map((usage) => requestTask(usage)),
  filter(isNotNull),
  tap(liveWorker.startTask)
);

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
