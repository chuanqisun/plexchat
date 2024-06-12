import type { ILogger } from "../scheduler/logger";
import type { WorkerChatProxy, WorkerChatProxyResult, WorkerChatStreamProxy } from "../scheduler/worker";
import type { ChatInput } from "./types";

export interface ProxyConfig {
  apiKey: string;
  endpoint: string;
  logger?: ILogger;
}
export function getOpenAIWorkerProxy({ apiKey, endpoint, logger }: ProxyConfig): WorkerChatProxy {
  return async (input: ChatInput, init?: RequestInit) => {
    const { response, error } = await fetchResponse({ apiKey, endpoint, logger }, input, init);
    if (error) return { error: error.message };

    const chatError = await parseOpenAIChatError(endpoint, response);
    if (chatError) return chatError;

    const result = await responseToJSON(response);
    return result;
  };
}

export function getOpenAIWorkerStreamProxy({ apiKey, endpoint, logger }: ProxyConfig): WorkerChatStreamProxy {
  return async function* (input: ChatInput, init?: RequestInit) {
    const { response, error } = await fetchResponse({ apiKey, endpoint, logger }, input, init);
    if (error) return { error: error.message };

    const chatError = await parseOpenAIChatError(endpoint, response);
    if (chatError) return chatError;

    yield* responseToStream(response);
  };
}

interface FetchSuccessResponse {
  response: Response;
  error?: undefined;
}
interface FetchErrorResponse {
  response?: Response;
  error: { message: string };
}
async function fetchResponse(
  { apiKey, endpoint, logger }: ProxyConfig,
  input: ChatInput,
  init?: RequestInit
): Promise<FetchSuccessResponse | FetchErrorResponse> {
  let response: Response | undefined = undefined;
  let error: { message: string } | undefined = undefined;
  try {
    if (logger) {
      logger.info(`[proxy] POST ${endpoint}\n${JSON.stringify(input, null, 2)}`);
    }

    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(input),
      ...init,
    });

    return {
      response,
      error: undefined,
    };
  } catch (e) {
    // fetch or abort error
    error = {
      message: `${(e as any)?.message}`,
    };

    return {
      response,
      error,
    };
  }
}

type OpenAIChatError = Pick<WorkerChatProxyResult, "error" | "retryAfterMs">;
async function parseOpenAIChatError(endpoint: string, response: Response): Promise<null | OpenAIChatError> {
  if (response.ok) return null;

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

type ProxyResult = Pick<WorkerChatProxyResult, "data"> | Pick<WorkerChatProxyResult, "error">;
async function responseToJSON(response: Response): Promise<ProxyResult> {
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
}

async function* responseToStream(response: Response): AsyncGenerator<ProxyResult> {
  try {
    if (!response.body) return { error: "Response body is empty" };

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      // Massage and parse the chunk of data
      const chunk = decoder.decode(value);
      const matches = chunk.matchAll(/^data: (\{.*\})$/gm);
      for (const match of matches) {
        const item = JSON.parse(match[1]);
        if ((item as any)?.error?.message) throw new Error((item as any).error.message);
        if (!Array.isArray(item?.choices)) throw new Error("Invalid response");
        yield {
          data: item,
        };
      }
    }
  } catch (e) {
    return { error: `${(e as any)?.message}` };
  }
}
