import { Assignment, Run, State, scheduler } from "../lib";

interface BinaryWorker {
  id: number;
  isBusy?: boolean;
}

function isIdle(): Selector<BinaryWorker> {
  return (worker, jobs) => (worker.isBusy ? [] : jobs);
}

function first(): Selector<BinaryWorker> {
  return (_worker, jobs) => (jobs.length ? [jobs[0]] : []);
}

function updateWorker(updateFn: (worker: BinaryWorker) => BinaryWorker): StateReducer<BinaryWorker> {
  return (assignment, state) => ({
    ...state,
    workers: state.workers.map((worker) => (worker.id === assignment.worker.id ? updateFn(worker) : worker)),
  });
}

function dequeueJob(): StateReducer<BinaryWorker> {
  return (assignment, state) => ({
    ...state,
    jobs: state.jobs.filter((job) => job.id !== assignment.job.id),
  });
}

function requeueJobOnError(): StateReducer<BinaryWorker> {
  return (assignment, state, result) => {
    if (result === "error") {
      return {
        ...state,
        jobs: [...state.jobs, assignment.job],
      };
    } else {
      return state;
    }
  };
}

const policy = createPolicy<BinaryWorker>({
  selectors: [isIdle(), first()],
  beforeRun: [updateWorker((w) => ({ ...w, isBusy: true })), dequeueJob()],
  run,
  afterRun: [updateWorker((w) => ({ ...w, isBusy: false })), requeueJobOnError()],
});

interface PolicyConfig<WorkerType, JobType, ResultType> {
  selectors: Selector<WorkerType, JobType>[];
  beforeRun: StateReducer[];
  run: Run<WorkerType, JobType, ResultType>;
  afterRun: StateReducer[];
}

type Selector<WorkerType = any, JobType = any> = (worker: WorkerType, jobs: JobType[]) => JobType[];
type StateReducer<WorkerType = any, JobType = any, ResultType = any> = (
  assignment: Assignment<WorkerType, JobType>,
  state: State<WorkerType, JobType>,
  result?: ResultType
) => State<WorkerType, JobType>;

function createPolicy<WorkerType = any, JobType = any, ResultType = any>(policyConfig: PolicyConfig<WorkerType, JobType, ResultType>) {
  return {
    select: (worker: WorkerType, jobs: JobType[]) => policyConfig.selectors.reduce((acc, match) => match(worker, acc), jobs),
    run: policyConfig.run,
    beforeRun: (assignment: Assignment<WorkerType, JobType>, state: State<WorkerType, JobType>) =>
      policyConfig.beforeRun.reduce((acc, fn) => fn(assignment, acc), state),
    afterRun: (assignment: Assignment<WorkerType, JobType>, state: State<WorkerType, JobType>, result: ResultType) =>
      policyConfig.afterRun.reduce((acc, fn) => fn(assignment, acc, result), state),
  };
}

const { addJob, addWorker } = scheduler(policy);

addJob({ id: 1 });
addWorker({ id: 1 });
addJob({ id: 2 });
addJob({ id: 3 });
addWorker({ id: 2 });
addJob({ id: 4 });
addJob({ id: 5 });
addJob({ id: 6 });

async function run(assignment: Assignment) {
  return new Promise((resolve) =>
    setTimeout(() => {
      const result = Math.random() > 0.5 ? "success" : "error";
      console.log("mock work done", { worker: assignment.worker.id, job: assignment.job.id, result });
      if (result === "success") {
        resolve(result);
      } else {
        resolve(result);
      }
    }, Math.random() * 2500)
  );
}
