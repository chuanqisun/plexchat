import gptTokenzier from "gpt-tokenizer";
import type { ChatInput, ChatMessage, ChatModelName, EmbedInput } from "../openai/types";

export async function defaultEstimateChatTokenDemand(input: ChatInput, context?: { models?: ChatModelName[] }) {
  const chatTokenDemand = gptTokenzier.encodeChat(normalizeMessages(input.messages), "gpt-3.5-turbo").length * 1.2;
  const functionCallTokenDemand = input.functions ? gptTokenzier.encode(JSON.stringify(input.functions)).length * 1.2 : 0;
  const responseTokenDemand = input.max_tokens;

  return chatTokenDemand + functionCallTokenDemand + responseTokenDemand;
}

export async function defaultEstimateEmbedTokenDemand(input: EmbedInput, context?: { models: ChatModelName[] }) {
  const arrayifiedInput = Array.isArray(input.input) ? input.input : [input.input];
  const tokenDemand = arrayifiedInput.map((str) => gptTokenzier.encode(str)).reduce((acc, cur) => acc + cur.length, 0);

  return tokenDemand;
}

/** convert function call message to assistant message */
function normalizeMessages(chatMessage: ChatMessage[]) {
  return chatMessage.map((message) => ({
    role: message.role === "tool" || message.role === "function" ? "assistant" : message.role,
    content: message.role === "tool" || message.role === "function" ? JSON.stringify(message.function_call ?? message.tool_calls) : message.content!,
  }));
}
