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

  function isNotNull<T>(value: T | null): value is T {
    return value !== null;
  }

  return {
    addWorker,
    submit,
    stop,
  };
}

// const { stop, submit, addWorker } = createScheduler();

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
  type: "taskAquired" | "taskCompleted";
  handle: TaskHandle;
}

// test worker harness
function createWorker() {
  const $workerEvents = new Subject<WorkerEvent>();
  const $consumptionRecords = new Subject<any>();

  const $reqUsed1s = $consumptionRecords.pipe(map(() => 1));
  const $reqRecovered1s = $consumptionRecords.pipe(
    delay(1_000),
    map(() => -1)
  );
  const $consumptionBalance1s = merge($reqUsed1s, $reqRecovered1s).pipe(scan((acc, value) => [...acc, value], [] as number[]));

  const $reqUsed10s = $consumptionRecords.pipe(map(() => 1));
  const $reqRecovered10s = $consumptionRecords.pipe(
    delay(10_000),
    map(() => -1)
  );
  const $consumptionBalance10s = merge($reqUsed10s, $reqRecovered10s).pipe(scan((acc, value) => [...acc, value], [] as number[]));

  const sum = (acc: number, value: number) => acc + value;

  const $60rpmIn10sec = $consumptionBalance10s.pipe(
    map((count) => ({ reqUsedIn10s: count.reduce(sum, 0) })),
    startWith({ rpm10sCapacity: 0 })
  );

  const $60rmIn3sec = $consumptionBalance1s.pipe(
    map((count) => ({ reqUsedIn3s: count.reduce(sum, 0) })),
    startWith({ reqUsedIn3s: 0 })
  );

  const allConstraints = [$60rmIn3sec, $60rpmIn10sec];

  const $capacity = combineLatest(allConstraints).pipe(map((contraints) => Object.fromEntries(contraints.flatMap(Object.entries))));

  return {
    $consumptionRecords,
    $capacity,
  };
}

const worker = createWorker();
worker.$capacity.subscribe((cap) => console.log(`[cap]`, JSON.stringify(cap)));
setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 100);
setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 200);
setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 1500);
setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 1600);

const heartbeat = interval(1000).pipe(take(5)).subscribe();
// 5 sec to kill
