import { describe, expect, it } from "vitest";
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
          apiVersion: "2024-02-15-preview",
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
});
