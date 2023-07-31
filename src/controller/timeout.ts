export function withTimeout(abortReason: string, timeout: number, controller: AbortController): () => void {
  const timeoutId = setTimeout(() => {
    controller.abort(abortReason);
  }, timeout);

  const unwatch = () => {
    clearTimeout(timeoutId);
  };

  return unwatch;
}

export const TIMEOUT_ABORT_REASON = "Request timed out";

export function getTimeoutFunction(minTimeoutMs: number, additionalMsPerToken: number) {
  return (tokenDemand: number) => minTimeoutMs + tokenDemand * additionalMsPerToken;
}
