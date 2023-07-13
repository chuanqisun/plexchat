import { Assignment, Transformer, scheduler } from "../lib";
import { Selector, dequeueJob, matchJobById, matchWorkerById, selectFirstJob, selectJobsPerWorker, updateWorker } from "../utils";

interface IntervalWorker {
  id: number;
  isDisabled?: boolean;
}

interface BasicJob {
  id: number;
}

const { addJob, addWorker } = scheduler({
  run,
  plexers: [selectJobsPerWorker<IntervalWorker>([excludeDisabledWorker(), selectFirstJob()])],
  beforeRun: [
    updateWorker<IntervalWorker>(matchWorkerById(), (w) => ({ ...w, isDisabled: true })),
    enableWorkerAfterTimeout(2000),
    dequeueJob(matchJobById<BasicJob>()),
  ],
  afterRun: [updateWorker<IntervalWorker>(matchWorkerById(), (w) => ({ ...w }))],
});

addJob({ id: 1 });
addJob({ id: 2 });
addJob({ id: 3 });
addJob({ id: 4 });
addJob({ id: 5 });
addJob({ id: 6 });
addWorker({ id: 1 });

function enableWorkerAfterTimeout(timeout: number): Transformer<IntervalWorker> {
  return ({ assignment, state, update }) => {
    setTimeout(() => {
      update((prev) => ({
        ...prev,
        workers: prev.workers.map((w) => (w.id === assignment.worker.id ? { ...w, isDisabled: false } : w)),
      }));
    }, timeout);
    return state;
  };
}

function excludeDisabledWorker(): Selector<IntervalWorker, BasicJob> {
  return (worker, jobs) => (worker.isDisabled ? [] : jobs);
}

async function run(assignment: Assignment) {
  return new Promise<void>((resolve) =>
    setTimeout(() => {
      console.log("mock work done", { worker: assignment.worker.id, job: assignment.job.id });
      resolve();
    }, 1)
  );
}
