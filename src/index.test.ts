import { describe, expect, it } from "vitest";
import type { ChatOutputStreamEvent } from "./openai/types";
import { plexchat } from "./plexchat/plexchat";
import { LogLevel } from "./scheduler/logger";

const instance = plexchat({
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
  ],
  logLevel: LogLevel.Error,
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
});
