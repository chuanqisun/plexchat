import { createChatEngine, getOpenAIJsonProxy } from "./chat";
import { demoChat } from "./chat-demo";
import { azureOpenAIChatWorker } from "./chat-worker";

const chat = createChatEngine({
  verbose: true,
  workers: [
    azureOpenAIChatWorker({
      proxy: getOpenAIJsonProxy({
        endpoint: "",
        apiKey: "",
      }),
      model: "gpt-35-turbo",
      tokenLimit: 200,
      tokenLimitWindowSize: 60_000,
    }),
  ],
});

demoChat(chat, ["gpt-35-turbo"], {
  messages: [
    {
      role: "user",
      content: "echo 123",
    },
  ],
  max_tokens: 150,
}).then((r) => console.log(r.choices[0].message.content));

demoChat(chat, ["gpt-35-turbo"], {
  messages: [
    {
      role: "user",
      content: "echo 456",
    },
  ],
  max_tokens: 150,
}).then((r) => console.log(r.choices[0].message.content));
