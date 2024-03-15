import { Subject } from "rxjs";
import type { ITaskPool, TaskEvent, TaskHandle } from "./types";

export function createTaskPool(): ITaskPool {
  const $taskEvent = new Subject<TaskEvent>();
  const taskPool = new Map<number, TaskHandle>();
  let taskId = 0;

  function create(task: any): TaskHandle {
    taskId++;
    console.log(`[pool] task created ${taskId}`);
    const handle = { id: taskId, task };
    $taskEvent.next({ type: "created", handle });
    return { id: taskId, task };
  }

  function add(handle: TaskHandle): TaskHandle {
    console.log(`[pool] task queued ${handle.id}`);
    taskPool.set(handle.id, handle);
    $taskEvent.next({ type: "queued", handle });
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
      $taskEvent.next({ type: "dispatched", handle });
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
