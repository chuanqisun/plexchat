import { describe, expect, it } from "vitest";
import type { ChatOutputStreamEvent } from "./openai/types";
import { plexchat, type SimpleChatInput } from "./plexchat/plexchat";
import { LogLevel } from "./scheduler/logger";

const instance = plexchat({
  // use we the same endpoint but split across different workers for testing
  manifests: [
    {
      apiKey: (import.meta as any).env.VITE_OPENAI_TEST_API_KEY as string,
      endpoint: (import.meta as any).env.VITE_OPENAI_TEST_ENDPOINT as string,
      models: [
        {
          deploymentName: "gpt-4o",
          modelName: "gpt-4o",
          contextWindow: 128_000,
          rpm: 2_700,
          tpm: 450_000,
        },
        {
          deploymentName: "text-embedding-ada-002",
          modelName: "text-embedding-ada-002",
          contextWindow: 2_048,
          rpm: 720,
          tpm: 120_000,
        },
      ],
    },
    {
      apiKey: (import.meta as any).env.VITE_OPENAI_TEST_API_KEY as string,
      endpoint: (import.meta as any).env.VITE_OPENAI_TEST_ENDPOINT as string,
      models: [
        {
          deploymentName: "gpt-35-turbo-16k",
          modelName: "gpt-3.5-turbo-16k",
          contextWindow: 16_384,
          rpm: 1_440,
          tpm: 240_000,
          apiVersion: "2024-02-01",
        },
      ],
    },
  ],
  logLevel: LogLevel.Info,
});

describe("e2e", () => {
  it("init", () => {
    expect(typeof instance.chatProxy).toBe("function");
  });

  it("simple chat", async () => {
    const response = await instance.chatProxy(
      {
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: "Hello!",
          },
        ],
      },
      {
        models: ["gpt-4o"],
      }
    );

    expect(typeof response.choices[0].message.content).toBe("string");
    expect(response.choices[0].message.content?.length).toBeGreaterThan(0);
  });

  it("multi-worker chat", async () => {
    const chatInput: SimpleChatInput = {
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: "Hello!",
        },
      ],
    };

    const responses = await Promise.all([
      instance.chatProxy(chatInput, { models: ["gpt-4o"] }),
      instance.chatProxy(chatInput, { models: ["gpt-3.5-turbo-16k"] }),
    ]);

    expect(responses.length).toBe(2);
    responses.map((response) => {
      expect(typeof response.choices[0].message.content).toBe("string");
      expect(response.choices[0].message.content?.length).toBeGreaterThan(0);
    });
  });

  it("simple embed", async () => {
    const response = await instance.embedProxy({
      input: "Hello!",
    });

    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data[0].embedding.length).toBe(1536);
  });

  it("streaming", async () => {
    const responseIter = instance.chatStreamProxy(
      {
        stream: true,
        max_tokens: 10,
        messages: [
          {
            role: "system",
            content: "just say `Hello` back`",
          },
          {
            role: "user",
            content: "Hello!",
          },
        ],
      },
      {
        models: ["gpt-4o"],
      }
    );

    const collectedResponse: ChatOutputStreamEvent[] = [];
    const onStreamEnd = Promise.withResolvers<any>();
    responseIter.subscribe({
      next: (response) => {
        collectedResponse.push(response);
      },
      complete: () => {
        onStreamEnd.resolve(collectedResponse);
      },
    });

    await onStreamEnd.promise;
    expect(collectedResponse.length).toBeGreaterThan(0);
    const combinedText = collectedResponse
      .flatMap((r) => r.choices.map((c) => c.delta.content))
      .filter(Boolean)
      .join("");

    expect(combinedText.toLocaleLowerCase()).toContain("hello");
  });

  it("abort by handle", async () => {
    const chatInput: SimpleChatInput = {
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: "Hello!",
        },
      ],
    };

    const tasks = [
      instance.chatProxy(chatInput, { models: ["gpt-4o"], abortHandle: "1" }),
      instance.chatProxy(chatInput, { models: ["gpt-3.5-turbo-16k"], abortHandle: "2" }),
      instance.chatProxy(chatInput, { models: ["gpt-3.5-turbo-16k"], abortHandle: "3" }),
      instance.chatProxy(chatInput, { models: ["gpt-3.5-turbo-16k"], abortHandle: "4" }),
    ];

    instance.abort("2");
    instance.abort("3");

    const responses = await Promise.allSettled(tasks);
    const okResponses = responses.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const errorResponses = responses.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(okResponses.length).toBe(2);
    okResponses
      .map((r) => r.value)
      .map((response) => {
        expect(typeof response.choices[0].message.content).toBe("string");
        expect(response.choices[0].message.content?.length).toBeGreaterThan(0);
      });

    expect(errorResponses.length).toBe(2);
    expect(errorResponses[0].reason.name).toBe("AbortError");
  });

  it("abort all", async () => {
    const chatInput: SimpleChatInput = {
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: "Hello!",
        },
      ],
    };

    const tasks = [
      instance.chatProxy(chatInput, { models: ["gpt-4o"], abortHandle: "1" }),
      instance.chatProxy(chatInput, { models: ["gpt-3.5-turbo-16k"], abortHandle: "2" }),
      instance.chatProxy(chatInput, { models: ["gpt-3.5-turbo-16k"], abortHandle: "3" }),
      instance.chatProxy(chatInput, { models: ["gpt-3.5-turbo-16k"], abortHandle: "4" }),
    ];

    instance.abortAll();

    const responses = await Promise.allSettled(tasks);
    const okResponses = responses.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const errorResponses = responses.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(okResponses.length).toBe(0);
    expect(errorResponses.length).toBe(4);
    expect(errorResponses[0].reason.name).toBe("AbortError");
  });

  it("abort stream", async () => {
    const responseIter = instance.chatStreamProxy(
      {
        stream: true,
        max_tokens: 10,
        messages: [
          {
            role: "system",
            content: "just say `Hello` back`",
          },
          {
            role: "user",
            content: "Hello!",
          },
        ],
      },
      {
        models: ["gpt-4o"],
        abortHandle: "1",
      }
    );

    const collectedResponse: ChatOutputStreamEvent[] = [];
    const onStreamEnd = Promise.withResolvers<any>();
    responseIter.subscribe({
      next: (response) => {
        collectedResponse.push(response);
      },
      error: (error) => {
        onStreamEnd.resolve(error);
      },
      complete: () => {
        onStreamEnd.resolve(collectedResponse);
      },
    });

    instance.abort("1");
    const err = await onStreamEnd.promise;
    expect(collectedResponse.length).toBe(0);
    expect(err.name).toBe("AbortError");
  });
});
