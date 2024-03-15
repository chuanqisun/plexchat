import { Subject } from "rxjs";
import type { TaskEvent, TaskHandle, TaskPool } from "./types";

export function createTaskPool(): TaskPool {
  const $taskEvent = new Subject<TaskEvent>();
  const taskPool = new Map<number, TaskHandle>();
  let taskId = 0;

  function create(task: any): TaskHandle {
    taskId++;
    console.log(`[pool] task created ${taskId}`);
    return { id: taskId, task };
  }

  function add(handle: TaskHandle): TaskHandle {
    console.log(`[pool] task added ${handle.id}`);
    taskPool.set(handle.id, handle);
    queueMicrotask(() => $taskEvent.next({ type: "added", handle }));
    return handle;
  }

  function cancel(handle: TaskHandle) {
    console.log(`[pool] task cancelled ${handle.id}`);
    taskPool.delete(handle.id);
    $taskEvent.next({ type: "cancelled", handle });
  }

  function cancelAll() {
    for (const handle of taskPool.values()) {
      cancel(handle);
    }
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
    cancelAll,
    create,
    dispatch,
  };
}
