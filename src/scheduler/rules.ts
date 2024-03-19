import type { MatchRule, SweepRule } from "./manager";

export const matchByModel: () => MatchRule = () => (workerTaskRequest, candidateTask) =>
  candidateTask.models.some((demandedModel) => workerTaskRequest.models.includes(demandedModel));

export const matchByToken: () => MatchRule = () => (workerTaskRequest, candidateTask) => candidateTask.tokenDemand <= workerTaskRequest.tokenCapacity;

export const globalTimeout: (option: { timeoutMs: number }) => SweepRule = (option) => (task) => {
  const duration = Date.now() - task.createdAt;
  return { shouldRemove: duration > option.timeoutMs, reason: `task expired, duration ${duration} ms` };
};
