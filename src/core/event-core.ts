import { Observable, Subject, filter, interval, map, merge, mergeMap, mergeWith, tap } from "rxjs";

interface TaskChange {
  type: "added" | "started" | "updated" | "completed" | "cancelled";
  handle: TaskHandle;
}

interface TaskHandle {
  id: number;
  task: any;
  abortController: AbortController;
}

const $heartbeat = interval(1000);
const $taskUpdates = new Subject<TaskChange>();
const $taskAnnouncement = $taskUpdates.pipe(
  filter((change) => change.type === "added"),
  map((change) => change.handle.task)
);

let taskId = 0;
const taskPool = new Map<number, TaskHandle>();
function submit(task: any): Observable<TaskChange> {
  return new Observable((subscriber) => {
    const id = taskId++;
    const abortController = new AbortController();
    const subscription = $taskUpdates.pipe(filter((taskChange) => taskChange.handle.id === id)).subscribe(subscriber);
    const handle: TaskHandle = { id, task, abortController };
    taskPool.set(id, handle);
    $taskUpdates.next({ type: "added", handle });

    return () => {
      subscription.unsubscribe();
    };
  });
}

function requestTask(capacity: any): TaskHandle | null {
  // naive scheduling
  const next = taskPool.values().next();
  if (next.value && Math.random() > 0.8) {
    taskPool.delete((next.value as TaskHandle).id);
    return next.value;
  } else {
    return null;
  }
}

function rejectTask(task: TaskHandle) {
  taskPool.set(task.id, task);
  $taskUpdates.next({ type: "added", handle: task });
}

function addWorker() {
  return new Observable((subscriber) => {
    const $heartbeat = interval(1000); // TODO replace with time based capacity change

    const $producerChange = $taskAnnouncement;
    const $consumerChange = new Subject<any>();

    const subscription = merge($producerChange, $consumerChange, $heartbeat)
      .pipe(
        map(() => requestTask(1)),
        filter((task) => task !== null),
        mergeMap((task) => {
          // run the task
          return new Observable<TaskChange>((subscriber) => {
            $consumerChange.next("capacity reduced");
            subscriber.next({ type: "started", handle: task! });
            setTimeout(() => {
              subscriber.next({ type: "updated", handle: task! });
            }, 1000);
            setTimeout(() => {
              subscriber.next({ type: "completed", handle: task! });
              subscriber.complete();
              $consumerChange.next("capacity increased");
            }, 2000);
          });
        }),
        tap((taskChange) => $taskUpdates.next(taskChange))
      )
      .subscribe(subscriber);

    return () => {
      subscription.unsubscribe();
    };
  });
}

const schedulerSubscription = $taskUpdates
  .pipe(
    tap((te) => console.log(`[task]`, JSON.stringify(te))),
    mergeWith($heartbeat)
  )
  .subscribe();
const worker1 = addWorker();
const worker2 = addWorker();
const work1Subscription = worker1.subscribe((we) => console.log(`[worker 1]`, JSON.stringify(we)));
const work2Subscription = worker2.subscribe((we) => console.log(`[worker 2]`, JSON.stringify(we)));

submit("task 1").subscribe();
submit("task 2").subscribe();
submit("task 3").subscribe();
submit("task 4").subscribe();
submit("task 5").subscribe();

setTimeout(() => {
  console.log("timeout exit");

  schedulerSubscription.unsubscribe();
  work1Subscription.unsubscribe();
  work2Subscription.unsubscribe();
}, 10000);
