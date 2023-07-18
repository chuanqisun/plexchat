import { createChatEngine, getEstimatedDemand, getInput, type ChatEngine, type SimpleChatInput } from "./chat";
import type { ChatInput, ChatOutput } from "./types";

export function demoChat(chatEngine: ChatEngine, models: string[], input: SimpleChatInput): Promise<ChatOutput> {
  const fullInput = getInput(input);
  const fullDemand = getEstimatedDemand(models, fullInput);
  return chatEngine(fullInput, fullDemand);
}

const chatEngine = createChatEngine({
  verbose: true,
  workers: [
    {
      id: "1",
      proxy: async (input) => mockChatApi("worker 1", input),
      spec: {
        models: ["model1", "model2"],
        tokenLimit: 2,
        tokenLimitWindowSize: 5000,
      },
      historyTasks: [],
    },
    {
      id: "2",
      proxy: async (input) => mockChatApi("worker 2", input),
      spec: {
        models: ["model1", "model2"],
        tokenLimit: 3,
        tokenLimitWindowSize: 5000,
      },
      historyTasks: [],
    },
  ],
});

function mockChatApi(prefix: string, input: ChatInput): Promise<ChatOutput> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.5) {
        resolve({
          choices: [
            {
              finish_reason: "stop",
              index: 0,
              message: {
                content: `${prefix} response to ${input.messages.join()}`,
                role: "assistant",
              },
            },
          ],
          usage: {
            completion_tokens: 100,
            prompt_tokens: 100,
            total_tokens: 100,
          },
        });
      } else {
        reject(`${prefix} mock error`);
      }
    }, 1000);
  });
}
demoChat(chatEngine, ["model1", "model2"], {
  messages: [
    {
      role: "user",
      content: "hello world 3",
    },
  ],
  max_tokens: 0,
}).then(console.log);

demoChat(chatEngine, ["model1", "model2"], {
  messages: [
    {
      role: "user",
      content: "hello world",
    },
  ],
  max_tokens: 0,
}).then(console.log);
demoChat(chatEngine, ["model1", "model2"], {
  messages: [
    {
      role: "user",
      content: "hello world 2",
    },
  ],
  max_tokens: 0,
}).then(console.log);
