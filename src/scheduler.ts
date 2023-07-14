import { solvePackingProblem } from "./packing";
import { createStore } from "./store";

interface SchedulerState {
  requests: ChatRequest[];
  endpoints: ChatEndpoint[];
}

interface ChatRequest {
  id: number;
  message: string;
  tokenDemand: number;
  callback: (result: string) => void;
}
interface ChatEndpoint {
  request: (message: string) => Promise<string>;
  tokenLimit: number;
  pendingTokenBlocks: {
    id: number;
    demand: number;
  }[];
}

const chat = multiplexedChat([
  {
    request: async (message) => {
      return new Promise((resolve, reject) => {
        const box = { resolve, reject };
        const method = Math.random() > 0.5 ? "resolve" : "reject";
        setTimeout(() => box[method](`worker 1: ${method} response to ${message}`), Math.random() * 2000);
      });
    },
    tokenLimit: 4000,
    pendingTokenBlocks: [],
  },
  {
    request: async (message) => {
      return new Promise((resolve, reject) => {
        const box = { resolve, reject };
        const method = Math.random() > 0.5 ? "resolve" : "reject";
        setTimeout(() => box[method](`worker 2: ${method} response to ${message}`), Math.random() * 2000);
      });
    },
    tokenLimit: 6000,
    pendingTokenBlocks: [],
  },
]);

chat("Hello", 3000).then(console.log);
chat("Hello 2", 4000).then(console.log);
chat("Hello 3", 2000).then(console.log);
chat("Hello 4", 5000).then(console.log);
chat("Hello 5", 1000).then(console.log);

export function multiplexedChat(endpoints: ChatEndpoint[]) {
  const store = createStore<SchedulerState>([
    {
      onInit: () => ({
        requests: [],
        endpoints,
      }),
    },
    {
      onTransformChange: ({ current, update }) => {
        let remainingRequests = [...current.requests];
        const assignments: { chat: ChatRequest; endpoint: ChatEndpoint }[] = [];

        current.endpoints.forEach((endpoint) => {
          if (!remainingRequests.length) return;

          const affordableRequests = optimalFill(endpoint, remainingRequests);
          endpoint.pendingTokenBlocks = affordableRequests.map((request) => ({
            id: request.id,
            demand: request.tokenDemand,
          }));
          remainingRequests = remainingRequests.filter((request) => !affordableRequests.includes(request));
          assignments.push(...affordableRequests.map((request) => ({ chat: request, endpoint })));
        });

        current.requests = remainingRequests;

        // run all assignments
        assignments.forEach(({ chat, endpoint }) => {
          endpoint.request(chat.message).then(
            (result) => {
              update((prev) => {
                const endpointIndex = prev.endpoints.indexOf(endpoint);
                prev.endpoints[endpointIndex].pendingTokenBlocks = prev.endpoints[endpointIndex].pendingTokenBlocks.filter((block) => block.id !== chat.id);
                return prev;
              });
              chat.callback(result);
            },
            () => {
              update((prev) => {
                const endpointIndex = prev.endpoints.indexOf(endpoint);
                prev.endpoints[endpointIndex].pendingTokenBlocks = prev.endpoints[endpointIndex].pendingTokenBlocks.filter((block) => block.id !== chat.id);
                prev.requests.push(chat);
                return prev;
              });
            }
          );
        });

        return current;
      },
    },
  ]);

  let currentId = 0;

  async function chat(message: string, tokenDemand: number) {
    return new Promise((resolve) => {
      store.update((prev) => {
        prev.requests.push({
          id: ++currentId,
          message,
          tokenDemand,
          callback: (result) => {
            resolve(result);
          },
        });
        return prev;
      });
    });
  }

  return chat;
}

function optimalFill(endpoint: ChatEndpoint, requests: ChatRequest[]) {
  const pickedIndices = solvePackingProblem(
    endpoint.tokenLimit,
    requests.map((request) => request.tokenDemand)
  );
  return pickedIndices.map((index) => requests[index]);
}
