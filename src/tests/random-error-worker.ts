import { Assignment, scheduler } from "../lib";
import { dequeueJob, matchJobById, matchResult, matchWorkerById, requeueJob, selectFirstJob, selectWorker, updateWorker } from "../utils";

interface BinaryWorker {
  id: number;
  isBusy?: boolean;
}

interface BasicJob {
  id: number;
}

const isError = (result: any) => result === "error";

const { addJob, addWorker } = scheduler({
  run,
  selectors: [selectWorker<BinaryWorker>((w) => !w.isBusy), selectFirstJob()],
  beforeRun: [updateWorker<BinaryWorker>(matchWorkerById(), (w) => ({ ...w, isBusy: true })), dequeueJob(matchJobById<BasicJob>())],
  afterRun: [updateWorker<BinaryWorker>(matchWorkerById(), (w) => ({ ...w, isBusy: false })), requeueJob(matchResult(isError))],
});

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
