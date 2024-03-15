import { Observable, Subject, Subscription, combineLatest, delay, filter, interval, map, merge, mergeMap, scan, startWith, takeUntil, tap } from "rxjs";

interface TaskEvent {
  type: "added" | "started" | "updated" | "completed" | "cancelled";
  handle: TaskHandle;
}

interface TaskHandle {
  id: number;
  task: any;
}

export function createTaskPool() {
  const $taskEvent = new Subject<TaskEvent>();
  const taskPool = new Map<number, TaskHandle>();
  let taskId = 0;

  function add(task: any): TaskHandle {
    const id = taskId++;
    console.log(`[pool] task added ${id}`);
    const handle: TaskHandle = { id, task };
    taskPool.set(id, handle);
    $taskEvent.next({ type: "added", handle });
    return handle;
  }

  function cancel(handle: TaskHandle) {
    console.log(`[pool] task cancelled ${handle.id}`);
    taskPool.delete(handle.id);
    $taskEvent.next({ type: "cancelled", handle });
  }

  function dispatch(usage: any): TaskHandle | null {
    const next = taskPool.values().next();
    const handle = next.value as TaskHandle;
    if (next.value) {
      console.log(`[pool] task dispatched ${handle.id}`);
      $taskEvent.next({ type: "started", handle });
      taskPool.delete(handle.id);
      return next.value;
    } else {
      return null;
    }
  }

  return {
    $taskEvent,
    add,
    cancel,
    dispatch,
  };
}

export function createScheduler() {
  const $heartbeat = interval(1000);
  const taskPool = createTaskPool();

  const $taskAnnouncement = taskPool.$taskEvent.pipe(
    filter((event) => event.type === "added"),
    map((event) => event.handle.task)
  );

  const $taskCancellation = taskPool.$taskEvent.pipe(
    filter((event) => event.type === "cancelled"),
    map((event) => event.handle)
  );

  function submit(task: any): Observable<TaskEvent> {
    return new Observable((subscriber) => {
      start();

      const handle = taskPool.add(task);
      const subscription = taskPool.$taskEvent.pipe(filter((taskEvent) => taskEvent.handle.id === handle.id)).subscribe(subscriber);

      return () => {
        taskPool.cancel(handle);
        subscription.unsubscribe();
      };
    });
  }

  function requestTask(capacity: any): TaskHandle | null {
    return taskPool.dispatch(capacity);
  }

  function retryTask(task: TaskHandle) {
    // TODO implement
  }

  let schedulerSubscription: Subscription | null;

  function start() {
    console.log(`[scheduler] started`);
    if (schedulerSubscription) return;
    schedulerSubscription = merge(taskPool.$taskEvent, $heartbeat).subscribe();
  }

  function stop() {
    schedulerSubscription?.unsubscribe();
    schedulerSubscription = null;
    console.log(`[scheduler] stopped`);
  }

  function addWorker(worker: Worker) {
    return combineLatest([$taskAnnouncement, worker.$usage]).pipe(
      tap(() => console.log("will request task")),
      map(([_annoucement, usage]) => requestTask(usage)),
      filter(isNotNull),
      mergeMap((handle) => {
        const $cancelSignal = $taskCancellation.pipe(filter((cancelTask) => cancelTask.id === handle.id));
        const $task = worker.startTask(handle);
        return $task.pipe(takeUntil($cancelSignal));
      }),
      tap((taskEvent) => taskPool.$taskEvent.next(taskEvent))
    );
  }

  return {
    addWorker,
    submit,
    stop,
  };
}

const { stop, submit, addWorker } = createScheduler();

const workerSub = addWorker(createWorker()).subscribe((we) => console.log(`[worker]`, JSON.stringify(we)));
const taskSub = submit("task 1").subscribe((t) => console.log(`[task]`, JSON.stringify(t)));

// // simulate abortion
// setTimeout(() => task1Sub.unsubscribe(), 500);

setTimeout(() => {
  stop();
  workerSub.unsubscribe();
}, 5000);

interface WorkerEvent {
  type: "taskAquired" | "taskChanged" | "taskCompleted";
  handle: TaskHandle;
}

interface Worker {
  startTask: (task: TaskHandle) => Observable<TaskEvent>;
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

  function startTask(task: TaskHandle): Observable<TaskEvent> {
    // TBD inject logic
    const $task = new Observable<TaskEvent>((subscriber) => {
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
    $taskEvents,
  };
}

// const worker = createWorker();
// worker.$usage.subscribe((cap) => console.log(`[cap]`, JSON.stringify(cap)));
// setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 100);
// setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 200);
// setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 1500);
// setTimeout(() => worker.$consumptionRecords.next({ timestamp: Date.now() }), 1600);

// const heartbeat = interval(1000).pipe(take(5)).subscribe();
// // 5 sec to kill

// // proposed protocol, to be wrapped in the scheduler?
// const liveWorker = createWorker();
// liveWorker.$usage.pipe(
//   map((usage) => requestTask(usage)),
//   filter(isNotNull),
//   tap(liveWorker.startTask)
// );

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
