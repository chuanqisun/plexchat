import { Assignment, Plexer, PlexerState, Transformer, UpdateScheduler } from "./lib";

// Transformers

export function updateWorker<W = any, J = any>(
  predicate: (candidateWorker: W, assignment: Assignment<W, J>) => boolean,
  updateFn: (worker: W, assignment: Assignment<W, J>) => W
): Transformer<W> {
  return ({ assignment, state }) => ({
    ...state,
    workers: state.workers.map((worker) => (predicate(worker, assignment) ? updateFn(worker, assignment) : worker)),
  });
}

export function dequeueJob<W = any, J = any>(predicate: (candidateJob: J, assignment: Assignment<any, J>) => boolean): Transformer<W, J> {
  return ({ assignment, state }) => ({
    ...state,
    jobs: state.jobs.filter((job) => !predicate(job, assignment)),
  });
}

export function requeueJob<W, J, R>(predicate: (candidateJob: J, assignment: Assignment<W, J>, result?: R) => boolean): Transformer<W, J, R> {
  return ({ assignment, state, result: resultOrError }) => {
    if (predicate(assignment.job, assignment, resultOrError)) {
      return {
        ...state,
        jobs: [...state.jobs, assignment.job],
      };
    }
    return state;
  };
}

// Plexers

export type Selector<W = any, J = any> = (worker: W, jobs: J[]) => J[];

export function selectJobsPerWorker<W = any, J = any>(selectors: Selector<W, J>[]): Plexer<W, J> {
  return ({ assignmentState, currentState }) => {
    const result: PlexerState<W, J> = {
      assignments: [...assignmentState.assignments],
      remainingWorkers: [...currentState.workers],
      remainingJobs: [...currentState.jobs],
    };

    return result.remainingWorkers.reduce((acc, candidate) => {
      if (!acc.remainingJobs.length) return acc;

      const qualifiedJobs = selectors.reduce((acc, match) => match(candidate, acc), acc.remainingJobs);
      if (qualifiedJobs.length) {
        acc.assignments.push(...qualifiedJobs.map((job) => ({ worker: candidate, job })));
        acc.remainingJobs = acc.remainingJobs.filter((j) => !qualifiedJobs.includes(j));
      }
      return acc;
    }, result);
  };
}

export function selectWorker<W>(predicate: (candidateWorker: W) => boolean): Selector<W> {
  return (worker, jobs) => (predicate(worker) ? jobs : []);
}

export function selectFirstJob(): Selector {
  return (_worker, jobs) => (jobs.length ? [jobs[0]] : []);
}

// Actions

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

// Predicates

export function matchWorkerById<T extends { id: any }>() {
  return (worker: T, assignment: Assignment<T>) => worker.id === assignment.worker.id;
}

export function matchJobById<T extends { id: any }>() {
  return (job: T, assignment: Assignment<T>) => job.id === assignment.job.id;
}

export function matchResult(predicate: (result: any) => boolean) {
  return (_: any, __: any, result: any) => predicate(result);
}
