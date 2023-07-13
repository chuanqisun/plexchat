import { Assignment, scheduler } from "../lib";
import { Selector, dequeueJob, matchJobById, matchWorkerById, selectFirstJob, selectJobsPerWorker, updateWorker } from "../utils";

interface ChatWorker {
  id: number;
  tokenLimit: number;
  activeJobs: { id: number; tokenDemand: number }[];
}

interface ChatJob {
  id: number;
  tokenDemand: number;
  message: string;
  callback: (result: string) => void;
}

// test
const { chat } = getMultiplexedChat();
chat("message 1", 1500).then(console.log);
chat("message 2", 1500).then(console.log);
chat("message 3", 1500).then(console.log);

function getMultiplexedChat() {
  let currentJobId = 0;

  async function chat(message: any, tokenDemand: number) {
    return new Promise<any>((resolve) => addJob({ id: ++currentJobId, tokenDemand, message, callback: resolve }));
  }

  async function run(assignment: Assignment) {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        assignment.job.callback(JSON.stringify({ worker: assignment.worker.id, response: assignment.job.message }));
        resolve();
      }, 1000);
    });
  }

  const { addJob, addWorker } = scheduler({
    run,
    plexers: [selectJobsPerWorker([greedyCapacityFill(), selectFirstJob()])],
    beforeRun: [
      updateWorker<ChatWorker>(matchWorkerById(), (w, assignment) => ({ ...w, activeJobs: [...w.activeJobs, assignment.job] })), // TODO use time window to update activeJobs
      dequeueJob(matchJobById()),
    ],
    afterRun: [updateWorker(matchWorkerById(), (w, assignment) => ({ ...w, activeJobs: w.activeJobs.filter((j) => j.id !== assignment.job.id) }))],
  });

  addWorker({ id: 1, tokenLimit: 2000, activeJobs: [] });
  addWorker({ id: 2, tokenLimit: 2000, activeJobs: [] });

  return { chat };
}

// TODO: DP based optimal fill
function greedyCapacityFill(): Selector {
  return (worker: ChatWorker, jobs: ChatJob[]) => {
    const remainingCapacity = worker.tokenLimit - worker.activeJobs.reduce((a, b) => a + b.tokenDemand, 0);
    const result = {
      remainingCapacity,
      affordableJobs: [] as ChatJob[],
    };

    jobs.reduce((acc, job) => {
      const isJobAffordable = job.tokenDemand <= acc.remainingCapacity;

      if (isJobAffordable) {
        acc.affordableJobs.push(job);
        acc.remainingCapacity -= job.tokenDemand;
        return acc;
      } else {
        return acc;
      }
    }, result);

    return result.affordableJobs;
  };
}
