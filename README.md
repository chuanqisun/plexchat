# Plexchat

High throughput Azure OpenAI Chat Client, consists of the following components:

**Worker manager**: Broadcast new tasks to the workers
**Worker**: Request task from manager based on available capacity

## Get started

Install

```bash
npm i plexchat
```

```ts
import { plexchat } from "plexchat";

const { chatProxy, embedProxy } = plexchat({
  manifests: [
    {
      apiKey: "<Azure OpenAI Api Key>",
      endpoint: "https://<your-deployment>.openai.azure.com",
      models: [
        {
          deploymentName: "gpt-35-turbo",
          modelName: "gpt-35-turbo",
          contextWindow: 4_096,
          rpm: 1_242,
          tpm: 207_000,
        },
        {
          deploymentName: "gpt-35-turbo-16k",
          modelName: "gpt-35-turbo-16k",
          contextWindow: 16_384,
          rpm: 1_440,
          tpm: 240_000,
        },
        {
          deploymentName: "gpt-4",
          modelName: "gpt-4",
          contextWindow: 8_192,
          rpm: 60,
          tpm: 10_000,
        },
        {
          deploymentName: "gpt-4-32k",
          modelName: "gpt-4-32k",
          contextWindow: 32_768,
          rpm: 360,
          tpm: 60_000,
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
});

chatProxy({
  messages: [
    {
      role: "system",
      content: `You are a computer scientist`,
    },
    {
      role: "user",
      content: `What is an algorithm?`,
    },
  ],
});

embedProxy(["Hello world", "Fizz buzz"]);
```

## Limitations

Only support **TypeScript** bundlers (e.g. vite, esbuild). Vanilla js is not distributed in the package
