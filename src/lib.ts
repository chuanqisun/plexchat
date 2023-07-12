export interface SchedulerConfig<W = any, J = any, R = any> {
  select: Select<W, J>;
  beforeRun: BeforeRun<W, J>;
  afterRun: AfterRun<W, J, R>;
  run: Run<W, J, R>;
}

export interface State<W = any, J = any> {
  workers: W[];
  jobs: J[];
}

export interface Assignment<W = any, J = any> {
  worker: W;
  job: J;
}

export type Run<W = any, J = any, R = any> = (assignment: Assignment<W, J>) => Promise<R>;
export type BeforeRun<W = any, J = any> = (assignment: Assignment<W, J>, state: State<W, J>) => State<W, J>;
export type AfterRun<W = any, J = any, R = any> = (assignment: Assignment<W, J>, state: State<W, J>, result: R) => State<W, J>;
export type Select<W, J> = (worker: W, jobs: J[]) => J[];

export function scheduler<W, J>({ select, beforeRun, afterRun, run }: SchedulerConfig<W, J>) {
  const state: State<W, J> = {
    workers: [],
    jobs: [],
  };

  const { update } = observable(onChange, state);

  function addJob(job: J) {
    update((prev) => {
      return {
        ...prev,
        jobs: [...prev.jobs, job],
      };
    });
  }

  function addWorker(worker: W) {
    update((prev) => {
      return {
        ...prev,
        workers: [...prev.workers, worker],
      };
    });
  }

  function onChange(current: State<W, J>, prev: State<W, J>) {
    // naive implementation
    let remainingJobs = [...current.jobs];
    const assignments: Assignment[] = [];

    for (const candidate of current.workers) {
      const qualifiedJobs = select(candidate, remainingJobs);
      if (qualifiedJobs.length) {
        assignments.push(...qualifiedJobs.map((job) => ({ worker: candidate, job })));
        remainingJobs = remainingJobs.filter((j) => !qualifiedJobs.includes(j));
      }
    }

    update((prev) => assignments.reduce(assignmentsReducer, prev));
  }

  function assignmentsReducer(state: State<W, J>, assignment: Assignment) {
    const updatedState = beforeRun(assignment, state);
    run(assignment).then((result) => update((prev) => afterRun(assignment, prev, result)));
    return updatedState;
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
