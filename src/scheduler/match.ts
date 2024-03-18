import type { MatchRule } from "./manager";
import type { IChatTask, IWorkerTaskRequest } from "./types";

export const matchByModel: MatchRule = (task: IChatTask, request: IWorkerTaskRequest) =>
  task.models.some((demandedModel) => request.models.includes(demandedModel));

export const matchByToken: MatchRule = (task: IChatTask, request: IWorkerTaskRequest) => task.tokenDemand <= request.tokenCapacity;
