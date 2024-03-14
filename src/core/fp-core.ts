import { Observable, Subject, Subscription, combineLatest, distinctUntilChanged, filter, interval, map, scan, takeWhile, tap } from "rxjs";

interface TaskPoolEvent {
  added?: { id: number; data?: any };
  started?: { id: number };
  updated?: { id: number; data?: any };
  completed?: { id: number };
}

interface Task {
  id: number;
  data?: any;
}

interface WorkerPoolEvent {
  added?: { id: number; worker: any };
  removed?: any;
  updated?: any;
}

interface Worker {
  run(task: any): Observable<any>;
  taskHandles?: Subscription[];
}

function createScheduler() {
  const $taskPoolEvent = new Subject<TaskPoolEvent>();
  const $workerPoolEvent = new Subject<WorkerPoolEvent>();
  const $heartBeat = interval(1000);

  let taskId = 0;
  let workerId = 0;

  const $taskPool = $taskPoolEvent.pipe(
    scan(
      (state, event) => {
        if (event.added) {
          return {
            ...state,
            tasks: [...state.tasks, event.added],
          };
        }

        if (event.started) {
          return {
            ...state,
            tasks: state.tasks.filter((task) => task.id !== event.started!.id),
          };
        }

        return state;
      },
      {
        tasks: [] as Task[],
      }
    ),
    distinctUntilChanged()
  );

  const $workerPool = $workerPoolEvent.pipe(
    scan(
      (state, event) => {
        if (event.added) {
          return {
            ...state,
            workers: [...state.workers, event.added.worker],
          };
        }

        return state;
      },
      {
        workers: [] as Worker[],
      }
    ),
    distinctUntilChanged()
  );

  const $assignment = combineLatest([$taskPool, $workerPool]).pipe(
    map(([taskPool, workerPool]) => {
      if (taskPool.tasks.length && workerPool.workers.length) {
        return [{ task: taskPool.tasks[0]!, worker: workerPool.workers[0]! }];
      } else {
        return [];
      }
    }),
    filter((taskWorkerPairs) => taskWorkerPairs.length > 0)
  );

  function start() {
    const sub = $assignment.subscribe((assignment) => {
      const { task, worker } = assignment[0];
      $taskPoolEvent.next({ started: { id: task.id } });
      $workerPoolEvent.next({ updated: worker });
      worker.run(task).subscribe({
        next: (data) => $taskPoolEvent.next({ updated: { id: task.id, data } }),
        complete: () => {
          $taskPoolEvent.next({ completed: { id: task.id } });
          $workerPoolEvent.next({ updated: worker });
        },
      });
    });

    const heartbeat = $heartBeat.subscribe();

    return {
      stop: () => {
        sub.unsubscribe();
        heartbeat.unsubscribe();
      },
    };
  }

  function addTask(task: any) {
    const $task = $taskPoolEvent.pipe(
      filter((event) => event.started?.id === task.id || event.updated?.id === task.id || event.completed?.id === task.id),
      takeWhile((event) => !event.completed)
    );

    return new Observable<TaskPoolEvent>((subscriber) => {
      const sub = $task.subscribe((event) => {
        if (event.updated) {
          subscriber.next(event);
        }

        if (event.completed) {
          subscriber.complete();
        }
      });

      $taskPoolEvent.next({ added: { id: ++taskId, data: task } });

      return {
        unsubscribe: () => {
          // TODO: abort task from pool and workers
          sub.unsubscribe();
        },
      };
    });
  }

  function addWorker(worker: Worker) {
    $workerPoolEvent.next({ added: { id: ++workerId, worker } });
  }

  // debug
  const $taskLog = $taskPoolEvent.pipe(tap((e) => console.log("[task]", JSON.stringify(e))));
  const $workerLog = $workerPoolEvent.pipe(tap((e) => console.log("[worker]", JSON.stringify(e))));

  combineLatest([$taskLog, $workerLog]).subscribe();

  return {
    start,
    addTask,
    addWorker,
  };
}

// test run
const scheduler = createScheduler();
const { stop } = scheduler.start();
// scheduler.addWorker({
//   run: (task: Task) => {
//     return new Observable((subscriber) => {
//       setTimeout(() => {
//         subscriber.next(`${task.id} step 1`);
//       }, Math.random() * 1000);
//       setTimeout(() => {
//         subscriber.next(`${task.id} step 2`);
//       }, 1000 + Math.random() * 1000);
//       setTimeout(() => {
//         subscriber.next(`${task.id} step 3`);
//         subscriber.complete();
//       }, 2000);
//     });
//   },
// });

scheduler.addTask({ data: "task 1" }).subscribe();
scheduler.addTask({ data: "task 2" }).subscribe();
scheduler.addTask({ data: "task 3" }).subscribe();
scheduler.addTask({ data: "task 4" }).subscribe();

setTimeout(() => {
  stop();
}, 5000);
