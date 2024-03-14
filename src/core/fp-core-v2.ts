import { Observable, Subject, combineLatest, filter, map, scan } from "rxjs";

interface TaskEvent {
  id: number;
  type: "added" | "dispatched" | "completed" | "cancelled";
  data?: any;
}

const $taskEvent = new Subject<TaskEvent>();

const $taskPool = $taskEvent.pipe(
  scan((state, event) => {
    state.set(event.id, event);
    return state;
  }, new Map<number, TaskEvent>())
);

interface WorkerEvent {
  id: number;
  type: "added" | "removed" | "changed";
  data?: any;
}

const $workerEvent = new Subject<WorkerEvent>();

const $workerPool = $workerEvent.pipe(
  scan((state, event) => {
    state.set(event.id, event);
    return state;
  }, new Map<number, WorkerEvent>())
);

const $assignment = combineLatest([$taskPool, $workerPool]).pipe(
  map(([taskPool, workerPool]) => {
    const task = [...taskPool.values()][0];
    const worker = [...workerPool.values()][0];
    if (!task || !worker) return;

    return { task, worker };
  })
);

let taskId = 0;
function submit(data: any) {
  return new Observable<TaskEvent>((subscriber) => {
    const id = ++taskId;
    const cancel = $taskEvent.pipe(filter((event) => event.id === id)).subscribe(subscriber);
    $taskEvent.next({ id, type: "added", data });

    return () => {
      cancel.unsubscribe();
      $taskEvent.next({ id, type: "cancelled" });
    };
  });
}
