import { concatMap, from } from "rxjs";
import type { ILogger } from "../scheduler/logger";
import type { WorkerChatProxy } from "../scheduler/worker";
import type { ChatInput } from "./types";

export interface ProxyConfig {
  apiKey: string;
  endpoint: string;
  logger?: ILogger;
}
export function getOpenAIWorkerProxy({ apiKey, endpoint, logger }: ProxyConfig): WorkerChatProxy {
  return (input: ChatInput, init?: RequestInit) => {
    const $result = from(fetchResponse({ apiKey, endpoint, logger }, input, init)).pipe(
      concatMap((res) => validateOpenAIResponse(endpoint, res)),
      concatMap((res) => from(input.stream ? responseToStream(res) : res.json()))
    );

    return $result;
  };
}

async function fetchResponse({ apiKey, endpoint, logger }: ProxyConfig, input: ChatInput, init?: RequestInit): Promise<Response> {
  if (logger) {
    logger.info(`[proxy] POST ${endpoint}\n${JSON.stringify(input, null, 2)}`);
  }

  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(input),
    ...init,
  });
}

async function validateOpenAIResponse(endpoint: string, response: Response): Promise<Response> {
  if (response.ok) return response;

  let retryAfterMs: number | undefined;
  let errorText: string;

  const { error } = (await response.json()) as { error: { code: string; message: string } };
  errorText = `${error?.code} ${error?.message ?? "Unknown API error"}`.trim();

  if (response.status === 429) {
    const cooldownText = response.headers.get("retry-after") ?? errorText.match(/(\d+) second/)?.[1];
    if (!cooldownText) console.warn("429 response received without specific retry timeout");
    console.warn(`[proxy] cooldown ${endpoint}: ${cooldownText}`);
    retryAfterMs = cooldownText ? (parseInt(cooldownText) + 1) * 1000 : 30_000; // add 1 sec for safety
    throw new RetryableError(errorText, retryAfterMs);
  } else {
    throw new Error(errorText);
  }
}

export class RetryableError extends Error {
  constructor(message: string, public retryAfterMs?: number) {
    super(message);
  }
}

async function* responseToStream(response: Response): AsyncGenerator {
  if (!response.body) throw new Error("Response body is empty");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let unfinishedLine = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    // Massage and parse the chunk of data
    const chunk = decoder.decode(value);

    // because the packets can split anywhere, we only process whole lines
    const currentWindow = unfinishedLine + chunk;
    unfinishedLine = currentWindow.slice(currentWindow.lastIndexOf("\n") + 1);

    const wholeLines = currentWindow
      .slice(0, currentWindow.lastIndexOf("\n") + 1)
      .split("\n")
      .filter(Boolean);

    const matches = wholeLines.map((wholeLine) => [...wholeLine.matchAll(/^data: (\{.*\})$/g)][0]?.[1]).filter(Boolean);

    for (const match of matches) {
      const item = JSON.parse(match);
      if ((item as any)?.error?.message) throw new Error((item as any).error.message);
      if (!Array.isArray(item?.choices)) throw new Error("Invalid response");
      yield item;
    }
  }
}
