// test code

const { addJob, addWorker } = scheduler({ onPick: handleJobPick, onStart: handleStart, onDone: handleJobSuccess });

addJob({ id: 1 });
addWorker({ id: 1, capacity: 1 });
addJob({ id: 2 });
addJob({ id: 3 });
addWorker({ id: 2, capacity: 1 });
addJob({ id: 4 });
addJob({ id: 5 });
addJob({ id: 6 });

function handleJobPick(worker: any, jobs: any[]): Assignment | null {
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

function handleStart(assignment: Assignment, state: IState, onDone: () => void): IState {
  setTimeout(() => {
    console.log("mock work done", { worker: assignment.worker.id, job: assignment.job.id });
    onDone();
  }, Math.random() * 2500);

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

function handleJobSuccess(assignment: Assignment, state: IState): IState {
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
  };
}

interface IState<W = any, J = any> {
  workers: W[];
  jobs: J[];
}

interface Assignment<W = any, J = any> {
  worker: W;
  job: J;
}

type OnJobStart<W = any, J = any> = (assignment: Assignment<W, J>, state: IState<W, J>, onDone: () => void) => IState<W, J>;
type OnJobDone<W = any, J = any> = (assignment: Assignment<W, J>, state: IState<W, J>) => IState<W, J>;

interface SchedulerConfig<W, J> {
  onPick: OnPick<W, J>;
  onStart: OnJobStart<W, J>;
  onDone: OnJobDone<W, J>;
}

type OnPick<W, J> = (worker: W, jobs: J[]) => Assignment<W, J> | null;
type OnCompareWorkers<W> = (a: W, b: W) => boolean;

function scheduler<WorkerType, JobType>({ onPick, onStart, onDone }: SchedulerConfig<WorkerType, JobType>) {
  const state: IState<WorkerType, JobType> = {
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

  function onChange(current: IState<WorkerType, JobType>, prev: IState<WorkerType, JobType>) {
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

  function assignmentsReducer(state: IState<WorkerType, JobType>, assignment: Assignment) {
    const onDoneInternal = () => update((prev) => onDone(assignment, prev));
    return onStart(assignment, state, onDoneInternal);
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
