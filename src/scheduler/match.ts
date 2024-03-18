import type { MatchRule } from "./manager";

export const matchByModel: MatchRule = (workerTaskRequest, candidateTask) =>
  candidateTask.models.some((demandedModel) => workerTaskRequest.models.includes(demandedModel));

export const matchByToken: MatchRule = (workerTaskRequest, candidateTask) => candidateTask.tokenDemand <= workerTaskRequest.tokenCapacity;
