import { Assignment, State, scheduler } from "../lib";

interface CapacityWorker {
  id: number;
  capacity: number;
  activeTasks: { id: number; cost: number }[];
}

interface CostedJobs {
  id: number;
  cost: number;
}

const { addJob, addWorker } = scheduler<CapacityWorker, CostedJobs>({ select: assign, run, beforeRun, afterRun });

addJob({ id: 1, cost: 1 });
addWorker({ id: 1, capacity: 3, activeTasks: [] });
addJob({ id: 2, cost: 3 });
addJob({ id: 3, cost: 2 });
addWorker({ id: 2, capacity: 1, activeTasks: [] });
addJob({ id: 4, cost: 2 });
addJob({ id: 5, cost: 1 });
addJob({ id: 6, cost: 1 });

async function run(assignment: Assignment) {
  return new Promise((resolve) =>
    setTimeout(() => {
      Math.random() > 0.5 ? resolve("success") : resolve("error");
    }, Math.random() * 2500)
  );
}

function assign(worker: CapacityWorker, jobs: CostedJobs[]): CostedJobs[] {
  // naive implementation
  const remainingCapacity = worker.capacity - worker.activeTasks.reduce((a, b) => a + b.cost, 0);
  const affordableJob = jobs.find((job) => job.cost <= remainingCapacity);

  if (affordableJob) {
    return [affordableJob];
  } else {
    return [];
  }
}

function compareById(a: CapacityWorker, b: CapacityWorker) {
  return a.id === b.id;
}

function beforeRun(assignment: Assignment<CapacityWorker>, state: State<CapacityWorker>): State<CapacityWorker, CostedJobs> {
  return {
    ...state,
    workers: state.workers.map((worker) => {
      if (compareById(worker, assignment.worker)) {
        return {
          ...worker,
          activeTasks: [...worker.activeTasks, assignment.job],
        };
      } else {
        return worker;
      }
    }),
    jobs: state.jobs.filter((job) => !compareById(job, assignment.job)),
  };
}

function afterRun(assignment: Assignment, state: State<CapacityWorker>, result: any): State {
  console.log("mock work done", { worker: assignment.worker.id, job: assignment.job.id, result });
  return {
    ...state,
    workers: state.workers.map((worker) => {
      if (compareById(worker, assignment.worker)) {
        return {
          ...worker,
          activeTasks: worker.activeTasks.filter((task) => task.id !== assignment.job.id),
        };
      }
      return worker;
    }),
    // return failed job
    jobs: result === "success" ? state.jobs : [...state.jobs, assignment.job],
  };
}
