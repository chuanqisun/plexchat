export interface SchedulerConfig<W, J, R> {
  plexers: Plexer<W, J>[];
  beforeRun: Transformer[];
  run: Run<W, J, R>;
  afterRun: Transformer[];
}

export type PlexerState<W = any, J = any> = {
  remainingWorkers: W[];
  remainingJobs: J[];
  assignments: Assignment<W, J>[];
};

export interface PlexerInput<W = any, J = any> {
  assignmentState: PlexerState<W, J>;
  currentState: State<W, J>;
  previousState: State<W, J>;
}
export type Plexer<W = any, J = any> = (input: PlexerInput<W, J>) => PlexerState<W, J>;

export interface TransformerInput<W = any, J = any, R = any> {
  assignment: Assignment<W, J>;
  state: State<W, J>;
  update: (updateFn: (prev: State<W, J>) => State<W, J>) => any;
  result?: R;
  error?: any;
}
export type Transformer<W = any, J = any, R = any> = (input: TransformerInput<W, J, R>) => State<W, J>;

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

export function scheduler<W, J, R>({ beforeRun, run, afterRun, plexers }: SchedulerConfig<W, J, R>) {
  const state: State<W, J> = {
    workers: [],
    jobs: [],
  };

  const { update } = observable(onChange, state);

  function onChange(current: State<W, J>, prev: State<W, J>) {
    const initialStateV2: PlexerState<W, J> = {
      remainingWorkers: [...current.workers],
      remainingJobs: [...current.jobs],
      assignments: [],
    };

    const { assignments } = plexers.reduce((acc, plexer) => plexer({ assignmentState: acc, currentState: current, previousState: prev }), initialStateV2);

    update((prev) => assignments.reduce(assignmentsReducer, prev));
  }

  function assignmentsReducer(state: State<W, J>, assignment: Assignment) {
    const updatedState = beforeRun.reduce((acc, fn) => fn({ assignment, state: acc, update }), state);
    run(assignment).then(
      (result) => update((prev) => afterRun.reduce((acc, fn) => fn({ assignment, state: acc, result, update }), prev)),
      (error) => update((prev) => afterRun.reduce((acc, fn) => fn({ assignment, state: acc, error, update }), prev))
    );
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
    update,
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
