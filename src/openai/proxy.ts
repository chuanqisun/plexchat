import type { WorkerChatProxy } from "../scheduler/worker";
import type { ChatInput } from "./types";

export interface ProxyConfig {
  apiKey: string;
  endpoint: string;
}
export function getOpenAIWorkerProxy({ apiKey, endpoint }: ProxyConfig): WorkerChatProxy {
  return async (input: ChatInput, init?: RequestInit) => {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(input),
        ...init,
      });
    } catch (e) {
      // fetch or abort error
      return {
        error: `${(e as any)?.message}`,
      };
    }

    if (!response.ok) {
      let retryAfterMs: number | undefined;
      let errorText: string;
      try {
        const { error } = (await response.json()) as { error: { code: string; message: string } };
        errorText = `${error?.code} ${error?.message ?? "Unknown API error"}`.trim();

        if (response.status === 429) {
          const cooldownText = response.headers.get("retry-after") ?? errorText.match(/(\d+) second/)?.[1];
          if (!cooldownText) console.warn("429 response received without specific retry timeout");
          console.warn(`[proxy] cooldown ${endpoint}: ${cooldownText}`);
          retryAfterMs = cooldownText ? (parseInt(cooldownText) + 1) * 1000 : 30_000; // add 1 sec for safety
        }
      } catch (e) {
        errorText = `${(e as any)?.message}`;
      } finally {
        return {
          retryAfterMs,
          error: errorText!,
        };
      }
    }

    try {
      const result = (await response.json()) as any;
      return {
        data: result,
      };
    } catch (e) {
      return {
        error: `${(e as any)?.message}`,
      };
    }
  };
}
