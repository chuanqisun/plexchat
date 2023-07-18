import { getOpenAIJsonProxy } from "../openai/proxy";
import { getChatTaskRunner } from "./chat";
import { azureOpenAIChatWorker } from "./chat-worker";
import { getSimpleRESTChat } from "./simple-chat";

const chatTaskRunner = getChatTaskRunner({
  verbose: true,
  workers: [
    azureOpenAIChatWorker({
      proxy: getOpenAIJsonProxy({
        endpoint: "<REPLACE>",
        apiKey: "<REPLACE>",
      }),
      model: "gpt-35-turbo",
      tokenLimit: 200,
      tokenLimitWindowSize: 3_000, // simulate limit: 200 tokens per 3 seconds
    }),
  ],
});

const chat = getSimpleRESTChat({
  chatTaskRunner,
  getTokenCount: (input) => input.flatMap((msg) => msg.content.split(" ")).length * 1.5,
});

chat(
  [
    {
      role: "user",
      content: "echo 123",
    },
  ],
  {
    max_tokens: 150,
  }
).then(console.log);

chat(
  [
    {
      role: "user",
      content: "echo 456",
    },
  ],
  {
    max_tokens: 150,
  }
).then(console.log);
