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

interface PolicyConfig<W, J, R> {
  selectors: Selector<W, J>[];
  beforeRun: StateReducer[];
  run: Run<W, J, R>;
  afterRun: StateReducer[];
}

type Selector<W = any, J = any> = (worker: W, jobs: J[]) => J[];
type StateReducer<W = any, J = any, R = any> = (assignment: Assignment<W, J>, state: State<W, J>, result?: R) => State<W, J>;

function createPolicy<W = any, J = any, R = any>(policyConfig: PolicyConfig<W, J, R>) {
  return {
    select: (worker: W, jobs: J[]) => policyConfig.selectors.reduce((acc, match) => match(worker, acc), jobs),
    run: policyConfig.run,
    beforeRun: (assignment: Assignment<W, J>, state: State<W, J>) => policyConfig.beforeRun.reduce((acc, fn) => fn(assignment, acc), state),
    afterRun: (assignment: Assignment<W, J>, state: State<W, J>, result: R) => policyConfig.afterRun.reduce((acc, fn) => fn(assignment, acc, result), state),
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
