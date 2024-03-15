import { createScheduler } from "./scheduler";
import { createTaskPool } from "./task-pool";
import { createWorker } from "./worker";
import { rpm10s, rpm3s } from "./worker-policies";

const { stop, submit } = createScheduler({
  pool: createTaskPool(),
  workers: [createWorker({ policies: [rpm10s(), rpm3s()] })],
});

// const workerSub = addWorker(createWorker()).subscribe((we) => console.log(`[worker]`, JSON.stringify(we)));
const taskSub = submit("task 1").subscribe((t) => console.log(`[task]`, JSON.stringify(t)));
setTimeout(() => submit("task 2").subscribe((t) => console.log(`[task]`, JSON.stringify(t))), 300);
setTimeout(() => submit("task 3").subscribe((t) => console.log(`[task]`, JSON.stringify(t))), 400);
setTimeout(() => submit("task 4").subscribe((t) => console.log(`[task]`, JSON.stringify(t))), 1500);
setTimeout(() => submit("task 5").subscribe((t) => console.log(`[task]`, JSON.stringify(t))), 1600);

// simulate abortion
setTimeout(() => taskSub.unsubscribe(), 1500);

setTimeout(() => {
  stop();
}, 15000);
