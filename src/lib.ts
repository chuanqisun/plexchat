// test code

const { addJob, addWorker } = scheduler({ assign: assign, run: run, beforeRun: beforeRun, afterRun });

addJob({ id: 1 });
addWorker({ id: 1, capacity: 1 });
addJob({ id: 2 });
addJob({ id: 3 });
addWorker({ id: 2, capacity: 1 });
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

function assign(worker: any, jobs: any[]): Assignment | null {
  // naive implementation
  if (worker.capacity && jobs.length) {
    return { worker, job: jobs[0] };
  } else {
    return null;
  }
}

function compareById(a: any, b: any) {
  return a.id === b.id;
}

function beforeRun(assignment: Assignment, state: State): State {
  return {
    ...state,
    workers: state.workers.map((worker) => {
      if (compareById(worker, assignment.worker)) {
        return {
          ...worker,
          capacity: 0,
        };
      } else {
        return worker;
      }
    }),
    jobs: state.jobs.filter((job) => !compareById(job, assignment.job)),
  };
}

function afterRun(result: any, assignment: Assignment, state: State): State {
  console.log("mock work done", { worker: assignment.worker.id, job: assignment.job.id, result });
  return {
    ...state,
    workers: state.workers.map((worker) => {
      if (compareById(worker, assignment.worker)) {
        return {
          ...worker,
          capacity: 1,
        };
      }
      return worker;
    }),
    // return failed job
    jobs: result === "success" ? state.jobs : [...state.jobs, assignment.job],
  };
}

interface SchedulerConfig<WorkerType = any, JobType = any, ResultType = any> {
  assign: OnPick<WorkerType, JobType>;
  beforeRun: BeforeRun<WorkerType, JobType>;
  afterRun: AfterRun<WorkerType, JobType, ResultType>;
  run: Run<WorkerType, JobType, ResultType>;
}

interface State<WorkerType = any, JobType = any> {
  workers: WorkerType[];
  jobs: JobType[];
}

interface Assignment<WorkType = any, JobType = any> {
  worker: WorkType;
  job: JobType;
}

type Run<WorkerType = any, JobType = any, ResultType = any> = (assignment: Assignment<WorkerType, JobType>) => Promise<ResultType>;

type BeforeRun<WorkerType = any, JobType = any> = (
  assignment: Assignment<WorkerType, JobType>,
  state: State<WorkerType, JobType>
) => State<WorkerType, JobType>;

type AfterRun<WorkerType = any, JobType = any, ResultType = any> = (
  result: ResultType,
  assignment: Assignment<WorkerType, JobType>,
  state: State<WorkerType, JobType>
) => State<WorkerType, JobType>;

type OnPick<WorkerType, JobType> = (worker: WorkerType, jobs: JobType[]) => Assignment<WorkerType, JobType> | null;

function scheduler<WorkerType, JobType>({ assign: onPick, beforeRun, afterRun, run }: SchedulerConfig<WorkerType, JobType>) {
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
      const assignment = onPick(candidate, remainingJobs);
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
