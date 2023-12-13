export interface IChatTaskManager {
  submit: (task: IChatTask) => Promise<any>;
  abortAll: () => void;
  abort: (selectTask: (task: IChatTask) => boolean) => void;
}

export interface IChatWorkerManager {
  request: (request: IWorkerTaskRequest) => IChatTask | null;
  respond: (task: IChatTask, response: IWorkerTaskResponse) => void;
}

export interface IWorkerTaskRequest {
  tokenCapacity: number;
  models: string[];
}

export interface IWorkerTaskResponse {
  data?: any;
  error?: any;
  shouldRetry?: boolean;
}

export interface IChatTask {
  tokenDemand: number;
  models: string[];
  input: any;
  context: any;
}

export interface IChatWorker {
  // worker must immediately request work and start polling
  start: (manager: IChatWorkerManager) => void;
  // worker must stop polling new tasks and immediately reject all running tasks with Abort error
  abortAll: () => void;
  // must only aborts selected tasks. If all tasks are aborted, it should stop too
  abort: (selectTask: (task: IChatTask) => boolean) => void;
  // worker must top polling future tasks but can continue with unfinished tasks
  stop: () => void;
}
