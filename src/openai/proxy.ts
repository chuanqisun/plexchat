import type { ChatInput, ChatOutput } from "../chat/types";

export interface ProxyConfig {
  apiKey: string;
  endpoint: string;
}
export const getOpenAIJsonProxy =
  ({ apiKey, endpoint }: ProxyConfig) =>
  async (input: ChatInput) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(`Azure OpenAI Chat API error: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    return result as ChatOutput;
  };
