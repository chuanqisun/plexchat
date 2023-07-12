## Worker

- Represent capacity to perform a job
- Can request job from dispatcher
- Does not report back to dispatcher

## Queue

- Represents a list of jobs to be done

## Dispatcher

- Dispatches the most fitting job to the worker upon worker's request
- Accepts jobs from the user

```javascript
const workers = [new AzureOpenAIChatWorker(), new AzureOpenAIChatWorker(), new AzureOpenAIChatWorker(), new AzureOpenAIChatWorker()];

const magicQueue = new MagicQueue();
workers.forEach((worker) => worker.join(magicQueue));

const chat = async (message: any) => {
  const worker = await getWorker(message, queue);
  const result = await worker.run(message);
  return result;
};
```
