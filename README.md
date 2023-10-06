# Plexchat

High throughput Azure OpenAI Chat Client

## Get started

Install

```bash
npm i plexchat
```

```ts
import { plexchat } from "plexchat";

const { gpt35Proxy, gpt4Proxy } = plexchat({
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
      ],
    },
  ],
});

gpt35Proxy({
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
```

## Limitations

Only support **TypeScript** bundlers (e.g. vite, esbuild). Vanilla js is not distributed in the package
