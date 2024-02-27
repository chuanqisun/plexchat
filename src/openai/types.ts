// schema: https://github.com/Azure/azure-rest-api-specs/blob/main/specification/cognitiveservices/data-plane/AzureOpenAI/inference/readme.md

// doc: https://learn.microsoft.com/en-us/azure/cognitive-services/openai/reference
export interface ChatInput {
  messages: ChatMessage[];
  /** @deprecate use tools instead */
  functions?: FunctionDefinition[];
  /** @deprecate use tool_cohice instead */
  function_call?: FunctionCallRequest;
  tools?: string;
  tool_choice?: string | ToolChoiceDetails;
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  stop: null | string | string[];
}

export type FunctionCallRequest = "auto" | "none" | { name: string };

export type ToolChoiceDetails = {
  type: "function";
  function: {
    name: string;
  };
};

export interface ChatMessage {
  role: "assistant" | "system" | "user" | "tool" | "function";
  content?: string;
  name?: string;
  function_call?: FunctionCallRecord;
  tool_calls?: ToolCallRecord[];
}

export interface ToolCallRecord {
  id: string;
  type: "function";
  function: FunctionCallRecord;
}

export interface FunctionCallRecord {
  name: string;
  arguments: string;
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: any;
}

export type ChatOutput = {
  choices: {
    finish_reason: "stop" | "length" | "content_filter" | null;
    index: number;
    message: ChatMessage;
  }[];
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
};

export type ChatModelName = "gpt-35-turbo" | "gpt-35-turbo-16k" | "gpt-4" | "gpt-4-32k";
export type EmbedModelName = "text-embedding-ada-002";
