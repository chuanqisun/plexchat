// schema: https://github.com/Azure/azure-rest-api-specs/blob/main/specification/cognitiveservices/data-plane/AzureOpenAI/inference/readme.md

// doc: https://learn.microsoft.com/en-us/azure/cognitive-services/openai/reference
export interface ChatInput {
  messages: ChatMessage[];
  tools?: ChatCompletionTool[];
  tool_choice?: ChatCompletionToolChoice;
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  stop: null | string | string[];

  /** @deprecate use `tools` instead */
  functions?: FunctionDefinition[];
  /** @deprecate use `tool_cohice` instead */
  function_call?: FunctionCallRequest;
}

export type FunctionCallRequest = "auto" | "none" | { name: string };

export interface ChatCompletionTool {
  type: "function";
  function: FunctionDefinition;
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: any;
}

export type ChatCompletionToolChoice = "none" | "auto" | ChatCompletionNamedToolChoice;

export interface ChatCompletionNamedToolChoice {
  type: "function";
  function: {
    name: string;
  };
}

export type ToolChoiceDetails = {
  type: "function";
  function: {
    name: string;
  };
};

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

export interface ChatMessage {
  role: "assistant" | "system" | "user" | "tool" | "function";
  content: string | null;
  name?: string;
  tool_calls?: ChatCompletionMessageToolCall[];
  /** @deprecated use `tool_calls` instead */
  function_call?: ChatCompletionMeesageToolCallFunction;
}

export interface ChatCompletionMessageToolCall {
  id: string;
  type: "function";
  function: ChatCompletionMeesageToolCallFunction;
}

export interface ChatCompletionMeesageToolCallFunction {
  name: string;
  arguments: string;
}

export interface EmbedInput {
  input: string[] | string;
  input_type?: string;
  user?: string;
  encoding_format?: string;
  dimensions?: number;
}

export interface EmbedOutput {
  object: string;
  data: {
    object: "embedding";
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export type ChatModelName = "gpt-35-turbo" | "gpt-35-turbo-16k" | "gpt-4" | "gpt-4-32k";
export type EmbedModelName = "text-embedding-ada-002";
