export default {};

type SubmitEvent = Event;
type ManagerQueueUpdateEvent = Event;
type WorkerQueueUpdateEvent = Event;

type Task = any;

type ManagerQueue = Task[];

type WorkerQueue = Task[];

type OnSubmit = (queue: ManagerQueue) => ManagerQueue;

type OnManagerQueueUpdate = (before: ManagerQueue, after: ManagerQueue) => ManagerQueueUpdateEvent;

type DisaptchPolicy = any;

type OnDispatch = (
  managerQueue: ManagerQueue,
  workerQueues: WorkerQueue[],
  policy: any
) => {
  updatedManagerQueue: ManagerQueue;
  updatedWorkerQueues: WorkerQueue[];
};

type OnWorkerQueueUpdate = (before: WorkerQueue, after: WorkerQueue) => Event;

// SubmitEvent => OnSubmit
// OnSubmit => ManagerQueueUpdateEvent
// (ManageQueueUpdateEvent, WorkerQueueUpdateEvent) => OnDispatch
// OnDispatch =?=> (ManagerQueueUpdateEvent, WorkerQueueUpdateEvent)
// WorkerQueueUpdateEvent => OnWorkerQueueUpdate
// OnWorkerQueueUpdate => WorkStartEvent
// WorkStartEvent =(external fn call with result wrapped)=> WorkDoneEvent<OK, Err>
// TimerEvent => WorkerQueueUpdateEvent
// WorkDoneEvent<OK> => (unwrap fn call result)
// WorkDoneEvent<Err> => HandleError
// HandleError => (retry ? WorkerQueueUpdateEvent : unwrap fn call result)
