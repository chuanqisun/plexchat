import { azureOpenAIChatWorker, createLoopChat, simpleChat } from "../chat";

const chat = createLoopChat({
  verbose: true,
  workers: [
    azureOpenAIChatWorker({
      endpoint: "",
      apiKey: "",
      model: "gpt-35-turbo",
      tokensPerMinute: 200,
    }),
  ],
});

simpleChat(chat, ["gpt-35-turbo"], {
  messages: [
    {
      role: "user",
      content: "echo 123",
    },
  ],
  max_tokens: 150,
}).then((r) => console.log(r.choices[0].message.content));

simpleChat(chat, ["gpt-35-turbo"], {
  messages: [
    {
      role: "user",
      content: "echo 456",
    },
  ],
  max_tokens: 150,
}).then((r) => console.log(r.choices[0].message.content));
