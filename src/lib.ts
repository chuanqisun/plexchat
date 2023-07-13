export interface PolicyConfig<W, J, R> {
  selectors: Selector<W, J>[];
  beforeRun: StateReducer[];
  run: Run<W, J, R>;
  afterRun: StateReducer[];
}

export type Selector<W = any, J = any> = (worker: W, jobs: J[]) => J[];
export type StateReducer<W = any, J = any, R = any> = (assignment: Assignment<W, J>, state: State<W, J>, result?: R) => State<W, J>;

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

export function scheduler<W, J, R>({
  selectors,
  beforeRun,
  run,
  afterRun,
}: PolicyConfig<W, J, R>): {
  update: UpdateScheduler<W, J>;
} {
  const state: State<W, J> = {
    workers: [],
    jobs: [],
  };

  const { update } = observable(onChange, state);

  function onChange(current: State<W, J>, prev: State<W, J>) {
    // naive implementation
    let remainingJobs = [...current.jobs];
    const assignments: Assignment[] = [];

    for (const candidate of current.workers) {
      const qualifiedJobs = selectors.reduce((acc, match) => match(candidate, acc), remainingJobs);
      if (qualifiedJobs.length) {
        assignments.push(...qualifiedJobs.map((job) => ({ worker: candidate, job })));
        remainingJobs = remainingJobs.filter((j) => !qualifiedJobs.includes(j));
      }
    }

    update((prev) => assignments.reduce(assignmentsReducer, prev));
  }

  function assignmentsReducer(state: State<W, J>, assignment: Assignment) {
    const updatedState = beforeRun.reduce((acc, fn) => fn(assignment, acc), state);
    run(assignment).then((result) => update((prev) => afterRun.reduce((acc, fn) => fn(assignment, acc, result), prev)));
    return updatedState;
  }

  return { update };
}

type ActionFactory<Return = any> = (update: UpdateScheduler) => Return;

// type MergeReturnTypes<T extends Array<Fn>> = T extends [infer First, ...infer Rest]
//   ? First extends (...args: any[]) => infer R
//     ? Rest extends Array<Fn>
//       ? MergeReturnTypes<Rest> & Omit<R, keyof MergeReturnTypes<Rest>>
//       : R
//     : never
//   : {};

type ReturnTypeOrEmpty<T> = T extends (...args: any[]) => infer R ? R : {};

type MergeReturnTypes<T extends Array<(...args: any) => any>> = T extends [infer F, ...infer Rest]
  ? Rest extends Array<(...args: any) => any>
    ? ReturnTypeOrEmpty<F> & Omit<MergeReturnTypes<Rest>, keyof ReturnTypeOrEmpty<F>>
    : ReturnTypeOrEmpty<F>
  : {};

export function exposeActions<W, J, B extends ((update: UpdateScheduler) => any)[]>(update: UpdateScheduler<W, J>, bindings: [...B]) {
  const bonds = bindings.map((binding) => binding(update));

  // merge all key value pairs into a single object
  const allKeyValPairs = bonds.flatMap(Object.entries);
  return Object.fromEntries(allKeyValPairs) as MergeReturnTypes<B>;
}

export function jobFactory<J = any>() {
  return (update: UpdateScheduler<any, J>) => ({
    addJob: (job: J) =>
      update((prev) => {
        return {
          ...prev,
          jobs: [...prev.jobs, job],
        };
      }),
  });
}

export function workerFactory<W = any>() {
  return (update: UpdateScheduler<W>) => ({
    addWorker: (worker: W) =>
      update((prev) => {
        return {
          ...prev,
          workers: [...prev.workers, worker],
        };
      }),
  });
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
