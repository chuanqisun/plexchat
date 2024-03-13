// use message passing
// separate dispatcher and worker
// orchestrate with top level scheduler

import type { Observable } from "rxjs";

function createScheduler() {
  const pool = [];
  const workers = [];

  function run(task: any): Observable<TaskEvent> {
    return {} as any;
  }
}

function createPool() {}

interface TaskEvent {
  taskId: number;
  type: "started" | "completed";
  data?: any;
}
