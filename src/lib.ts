export interface SchedulerConfig<W, J, R> {
  selectors: Selector<W, J>[];
  beforeRun: StateReducer[];
  run: Run<W, J, R>;
  afterRun: StateReducer[];
}

export type Selector<W = any, J = any> = (worker: W, jobs: J[]) => J[];
export type StateReducer<W = any, J = any, R = any> = (assignment: Assignment<W, J>, state: State<W, J>, resultOrError?: R) => State<W, J>;

export interface State<W = any, J = any> {
  workers: W[];
  jobs: J[];
}

export interface Assignment<W = any, J = any> {
  worker: W;
  job: J;
}

export type Run<W = any, J = any, R = any> = (assignment: Assignment<W, J>) => Promise<R>;

export type UpdateScheduler<W = any, J = any> = (updateFn: (prev: State<W, J>) => State<W, J>) => void;

export function scheduler<W, J, R>({ selectors, beforeRun, run, afterRun }: SchedulerConfig<W, J, R>) {
  const state: State<W, J> = {
    workers: [],
    jobs: [],
  };

  const { update } = observable(onChange, state);

  function onChange(current: State<W, J>, prev: State<W, J>) {
    const initialState = {
      assignments: [] as Assignment[],
      remainingJobs: [...current.jobs],
    };

    const { assignments } = current.workers.reduce((acc, candidate) => {
      if (!acc.remainingJobs.length) return acc;

      const qualifiedJobs = selectors.reduce((acc, match) => match(candidate, acc), acc.remainingJobs);
      if (qualifiedJobs.length) {
        acc.assignments.push(...qualifiedJobs.map((job) => ({ worker: candidate, job })));
        acc.remainingJobs = acc.remainingJobs.filter((j) => !qualifiedJobs.includes(j));
      }
      return acc;
    }, initialState);

    update((prev) => assignments.reduce(assignmentsReducer, prev));
  }

  function assignmentsReducer(state: State<W, J>, assignment: Assignment) {
    const updatedState = beforeRun.reduce((acc, fn) => fn(assignment, acc), state);
    run(assignment)
      .catch((e) => e)
      .then((result) => update((prev) => afterRun.reduce((acc, fn) => fn(assignment, acc, result), prev)));
    return updatedState;
  }

  function addJob(...jobs: J[]) {
    update((prev) => {
      return {
        ...prev,
        jobs: [...prev.jobs, ...jobs].filter((j, i, arr) => arr.indexOf(j) === i),
      };
    });
  }

  function addWorker(...workers: W[]) {
    update((prev) => {
      return {
        ...prev,
        workers: [...prev.workers, ...workers].filter((w, i, arr) => arr.indexOf(w) === i),
      };
    });
  }

  return {
    addJob,
    addWorker,
  };
}

function observable<T>(onChange: (current: T, previous: T) => any, initialValue: T) {
  let state = initialValue;

  function update(updateFn: (prev: T) => T) {
    const prev = state;
    state = updateFn(state);
    if (state !== prev) {
      onChange(state, prev);
    }
  }

  return {
    update,
  };
}
