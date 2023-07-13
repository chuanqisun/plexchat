// toolkit

import { Selector, StateReducer, UpdateScheduler } from "./lib";

export function updateWorker<W>(predicate: (candidateWorker: W, assignmentWorker: W) => boolean, updateFn: (worker: W) => W): StateReducer<W> {
  return (assignment, state) => ({
    ...state,
    workers: state.workers.map((worker) => (predicate(worker, assignment.worker) ? updateFn(worker) : worker)),
  });
}

export function dequeueJob<J>(predicate: (candidateJob: J, assignmentJob: J) => boolean): StateReducer<unknown, J> {
  return (assignment, state) => ({
    ...state,
    jobs: state.jobs.filter((job) => !predicate(job, assignment.job)),
  });
}

export function requeueJob<J, R>(predicate: (candidateJob: J, assignmentJob: J, result?: R) => boolean): StateReducer<unknown, J, R> {
  return (assignment, state, result) => {
    if (predicate(assignment.job, assignment.job, result)) {
      return {
        ...state,
        jobs: [...state.jobs, assignment.job],
      };
    }
    return state;
  };
}

export function selectWorker<W>(predicate: (candidateWorker: W) => boolean): Selector<W> {
  return (worker, jobs) => (predicate(worker) ? jobs : []);
}

export function selectFirstJob(): Selector {
  return (_worker, jobs) => (jobs.length ? [jobs[0]] : []);
}

export function defaultActions<W = any, J = any>() {
  return (update: UpdateScheduler<W, J>) => ({
    addJob: (job: J) =>
      update((prev) => {
        return {
          ...prev,
          jobs: [...prev.jobs, job],
        };
      }),
    addWorker: (worker: W) =>
      update((prev) => {
        return {
          ...prev,
          workers: [...prev.workers, worker],
        };
      }),
  });
}

export function matchById<T extends { id: any }>() {
  return (a: T, b: T) => a.id === b.id;
}

export function matchResult(predicate: (result: any) => boolean) {
  return (_: any, __: any, result: any) => predicate(result);
}
