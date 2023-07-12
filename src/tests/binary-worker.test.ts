import { Assignment, State, scheduler } from "../lib";

interface BinaryWorker {
  id: number;
  isIdle: boolean;
}

const { addJob, addWorker } = scheduler<BinaryWorker, any>({ select: assign, run, beforeRun, afterRun });

addJob({ id: 1 });
addWorker({ id: 1, isIdle: true });
addJob({ id: 2 });
addJob({ id: 3 });
addWorker({ id: 2, isIdle: true });
addJob({ id: 4 });
addJob({ id: 5 });
addJob({ id: 6 });

async function run(assignment: Assignment) {
  return new Promise((resolve) =>
    setTimeout(() => {
      Math.random() > 0.5 ? resolve("success") : resolve("error");
    }, Math.random() * 2500)
  );
}

function assign(worker: BinaryWorker, jobs: any[]): any[] {
  // naive implementation
  if (worker.isIdle && jobs.length) {
    return [jobs[0]];
  } else {
    return [];
  }
}

function compareById(a: BinaryWorker, b: BinaryWorker) {
  return a.id === b.id;
}

function beforeRun(assignment: Assignment<BinaryWorker>, state: State<BinaryWorker>): State {
  return {
    ...state,
    workers: state.workers.map((worker) => {
      if (compareById(worker, assignment.worker)) {
        return {
          ...worker,
          isIdle: false,
        };
      } else {
        return worker;
      }
    }),
    jobs: state.jobs.filter((job) => !compareById(job, assignment.job)),
  };
}

function afterRun(assignment: Assignment, state: State<BinaryWorker>, result: any): State {
  console.log("mock work done", { worker: assignment.worker.id, job: assignment.job.id, result });
  return {
    ...state,
    workers: state.workers.map((worker) => {
      if (compareById(worker, assignment.worker)) {
        return {
          ...worker,
          isIdle: true,
        };
      }
      return worker;
    }),
    // return failed job
    jobs: result === "success" ? state.jobs : [...state.jobs, assignment.job],
  };
}
