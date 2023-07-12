// test code

// utils
function updateWorker(predicate: (worker: any) => boolean, updateFn: (worker: any) => any) {}
function removeJob(predicate: (job: any) => boolean) {}
function returnJob(predicate: (result: any, job: any) => boolean) {}

export interface SchedulerConfig<WorkerType = any, JobType = any, ResultType = any> {
  assign: Assign<WorkerType, JobType>;
  beforeRun: BeforeRun<WorkerType, JobType>;
  afterRun: AfterRun<WorkerType, JobType, ResultType>;
  run: Run<WorkerType, JobType, ResultType>;
}

export interface State<WorkerType = any, JobType = any> {
  workers: WorkerType[];
  jobs: JobType[];
}

export interface Assignment<WorkType = any, JobType = any> {
  worker: WorkType;
  job: JobType;
}

export type Run<WorkerType = any, JobType = any, ResultType = any> = (assignment: Assignment<WorkerType, JobType>) => Promise<ResultType>;

export type BeforeRun<WorkerType = any, JobType = any> = (
  assignment: Assignment<WorkerType, JobType>,
  state: State<WorkerType, JobType>
) => State<WorkerType, JobType>;

export type AfterRun<WorkerType = any, JobType = any, ResultType = any> = (
  result: ResultType,
  assignment: Assignment<WorkerType, JobType>,
  state: State<WorkerType, JobType>
) => State<WorkerType, JobType>;

export type Assign<WorkerType, JobType> = (worker: WorkerType, jobs: JobType[]) => Assignment<WorkerType, JobType> | null;

export function scheduler<WorkerType, JobType>({ assign, beforeRun, afterRun, run }: SchedulerConfig<WorkerType, JobType>) {
  const state: State<WorkerType, JobType> = {
    workers: [],
    jobs: [],
  };

  const { update } = observable(onChange, state);

  function addJob(job: JobType) {
    update((prev) => {
      return {
        ...prev,
        jobs: [...prev.jobs, job],
      };
    });
  }

  function addWorker(worker: WorkerType) {
    update((prev) => {
      return {
        ...prev,
        workers: [...prev.workers, worker],
      };
    });
  }

  function onChange(current: State<WorkerType, JobType>, prev: State<WorkerType, JobType>) {
    // naive implementation
    let remainingJobs = [...current.jobs];
    const assignments: Assignment[] = [];

    for (const candidate of current.workers) {
      const assignment = assign(candidate, remainingJobs);
      if (assignment) {
        assignments.push(assignment);
        remainingJobs = remainingJobs.filter((j) => j !== assignment.job);
      }
    }

    update((prev) => assignments.reduce(assignmentsReducer, prev));
  }

  function assignmentsReducer(state: State<WorkerType, JobType>, assignment: Assignment) {
    const updatedState = beforeRun(assignment, state);
    run(assignment).then((result) => update((prev) => afterRun(result, assignment, prev)));
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
