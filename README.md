# Plexchat

High throughput Azure OpenAI Chat Client.

- Compatible with Azure Open AI chat and embedding API
- Instantiate one worker per API endpoint, with endpoint specific rate and token limit
- Customizable tokenzier for either estimated (fast) or precise (slow) token length control
- Built-in retry based on HTTP header and heuristics
- Built-in queue for burst of traffic


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

## How does it work

We instantiate one [worker](https://github.com/chuanqisun/plexchat/blob/master/src/scheduler/worker.ts) for each endpoint. The worker polls the manager for task by announcing its current capacity. The capacity is based on:
1. Token limit
2. Rate limit
3. Past consumption

The [manager](https://github.com/chuanqisun/plexchat/blob/master/src/scheduler/manager.ts) uses a queue to track user requests. Each user request is decorated with metadata about its demand:
1. Prompt token consumption
2. Max response token limit
3. Model compatibility

The manager dispatches the task to the first polling worker that has a capacity that meets or exceeds the demand. When the worker finishes the task, the result is returned to the user. When the worker fails the task, the task is requeued until all retries are used up.

For user convenience, we provide [a factory to instantiate the manager](https://github.com/chuanqisun/plexchat/blob/master/src/plexchat/plexchat.ts) as Azure Open AI embed and chat proxies. We also provide [a factory to instantiate the worker](https://github.com/chuanqisun/plexchat/blob/master/src/plexchat/plexchat-worker.ts) against Azure Open AI specific endpoints


### Polling convention

- Manager wakes up workers upon receiving every new task
- Worker polls indefinitely, and goes to sleep after they received at least one task and finished all assigned tasks.

## Limitations

- Only support **TypeScript** bundlers (e.g. vite, esbuild). Vanilla js is not distributed in the package

## Future work

- Customizable prioritization rules for the task queue
- Server-sent events (SSE) for chat response
- HTTP based remote workers
- Docker-deployable HTTP server
- Automatic rate limit detection by Azure Open AI admin API
