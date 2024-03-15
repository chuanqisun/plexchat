import { createScheduler } from "./scheduler";
import { createTaskPool } from "./task-pool";
import { createWorker } from "./worker";

const { stop, submit } = createScheduler({
  pool: createTaskPool(),
  workers: [createWorker()],
});

// const workerSub = addWorker(createWorker()).subscribe((we) => console.log(`[worker]`, JSON.stringify(we)));
const taskSub = submit("task 1").subscribe((t) => console.log(`[task]`, JSON.stringify(t)));

// // simulate abortion
setTimeout(() => taskSub.unsubscribe(), 1500);

setTimeout(() => {
  stop();
}, 5000);
