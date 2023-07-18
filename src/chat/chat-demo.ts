import { getChatTaskRunner, getEstimatedDemand, getInput, type ChatTask, type ChatTaskRunner, type SimpleChatInput } from "./chat";
import type { ChatInput, ChatOutput, ModelName } from "./types";

export function demoChat(runChatTask: ChatTaskRunner, models: ModelName[], input: SimpleChatInput): Promise<ChatOutput> {
  return new Promise((resolve, reject) => {
    const fullInput = getInput(input);
    const fullDemand = getEstimatedDemand(models, fullInput);
    const chatTask: ChatTask = {
      id: crypto.randomUUID(),
      input: fullInput,
      demand: fullDemand,
      retryLeft: 99,
      onSuccess: resolve,
      onError: reject,
    };
    runChatTask(chatTask);
  });
}

const chatEngine = getChatTaskRunner({
  verbose: true,
  workers: [
    {
      id: "1",
      proxy: async (input) => mockChatApi("worker 1", input),
      spec: {
        models: ["gpt-35-turbo", "gpt-4"],
        tokenLimit: 5,
        tokenLimitWindowSize: 1000,
      },
      historyTasks: [],
    },
    {
      id: "2",
      proxy: async (input) => mockChatApi("worker 2", input),
      spec: {
        models: ["gpt-35-turbo", "gpt-4"],
        tokenLimit: 5,
        tokenLimitWindowSize: 1000,
      },
      historyTasks: [],
    },
  ],
});

function mockChatApi(prefix: string, input: ChatInput): Promise<ChatOutput> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.5) {
        console.log(`${prefix} will resolve`);
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
demoChat(chatEngine, ["gpt-35-turbo", "gpt-4"], {
  messages: [
    {
      role: "user",
      content: "hello world 3",
    },
  ],
  max_tokens: 0,
})
  .then(() => console.log("task 1 resolved"))
  .catch(() => console.log("task 1 error"));

demoChat(chatEngine, ["gpt-35-turbo", "gpt-4"], {
  messages: [
    {
      role: "user",
      content: "hello world",
    },
  ],
  max_tokens: 0,
})
  .then(() => console.log("task 2 resolved"))
  .catch(() => console.log("task 2 error"));

demoChat(chatEngine, ["gpt-35-turbo", "gpt-4"], {
  messages: [
    {
      role: "user",
      content: "hello world 2",
    },
  ],
  max_tokens: 0,
})
  .then(() => console.log("task 3 resolved"))
  .catch(() => console.log("task 3 error"));
