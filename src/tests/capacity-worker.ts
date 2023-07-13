import { Assignment, Selector, scheduler } from "../lib";
import { defaultActions, dequeueJob, matchJobById, matchWorkerById, selectFirstJob, updateWorker } from "../utils";

interface CapacityWorker {
  id: number;
  capacity: number;
  activeJobs: { id: number; cost: number }[];
}

interface CapacityJob {
  id: number;
  cost: number;
}

const { addJob, addWorker } = scheduler({
  run,
  selectors: [greedyCapacityFill(), selectFirstJob()],
  beforeRun: [
    updateWorker<CapacityWorker>(matchWorkerById(), (w, assignment) => ({ ...w, activeJobs: [...w.activeJobs, assignment.job] })),
    dequeueJob(matchJobById()),
  ],
  afterRun: [updateWorker(matchWorkerById(), (w, assignment) => ({ ...w, activeJobs: w.activeJobs.filter((j) => j.id !== assignment.job.id) }))],
  actions: [defaultActions<CapacityWorker, CapacityJob>()],
});

addJob({ id: 1, cost: 1 });
addWorker({ id: 1, capacity: 3, activeJobs: [] });
addJob({ id: 2, cost: 3 });
addJob({ id: 3, cost: 2 });
addWorker({ id: 2, capacity: 1, activeJobs: [] });
addJob({ id: 4, cost: 2 });
addJob({ id: 5, cost: 1 });
addJob({ id: 6, cost: 1 });

async function run(assignment: Assignment) {
  return new Promise<void>((resolve) => {
    console.log("mock work started", { worker: assignment.worker.id, job: assignment.job.id });
    setTimeout(() => {
      console.log("mock work done", { worker: assignment.worker.id, job: assignment.job.id });
      resolve();
    }, Math.random() * 2500);
  });
}

// TODO: DP based optimal fill
function greedyCapacityFill(): Selector {
  return (worker: CapacityWorker, jobs: CapacityJob[]) => {
    const remainingCapacity = worker.capacity - worker.activeJobs.reduce((a, b) => a + b.cost, 0);
    const result = {
      remainingCapacity,
      affordableJobs: [] as CapacityJob[],
    };

    jobs.reduce((acc, job) => {
      const isJobAffordable = job.cost <= acc.remainingCapacity;

      if (isJobAffordable) {
        acc.affordableJobs.push(job);
        acc.remainingCapacity -= job.cost;
        return acc;
      } else {
        return acc;
      }
    }, result);

    return result.affordableJobs;
  };
}
