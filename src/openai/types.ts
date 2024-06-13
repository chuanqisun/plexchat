// schema: https://github.com/Azure/azure-rest-api-specs/blob/main/specification/cognitiveservices/data-plane/AzureOpenAI/inference/readme.md

// doc: https://learn.microsoft.com/en-us/azure/cognitive-services/openai/reference
export interface ChatInput {
  messages: ChatInputMessage[];
  tools?: ChatCompletionTool[];
  tool_choice?: ChatCompletionToolChoice;
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  response_format?: ChatCompletionResponseFormat;
  stop: null | string | string[];
  stream?: boolean;

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

export interface ChatCompletionResponseFormat {
  type: "json_object" | "text";
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
    message: ChatOutputMessage;
  }[];
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
};

/**
 * Different from Open AI, the initial no-Delta event and the last "DONE" event are implicit as the iterator starts and ends
 */
export type ChatOutputStreamEvent = {
  id: string;
  object: string;
  model?: string;
  created?: number;
  /** This array can be empty on the first event */
  choices: {
    finish_reason: "stop" | "length" | "content_filter" | null;
    index: number;
    delta: ChatOutputStreamDelta;
  }[];
};

/** The delta object can be empty on the last event */
export interface ChatOutputStreamDelta {
  role?: "user" | "assistant";
  content?: string;
}

export interface ChatInputMessage {
  role: "assistant" | "system" | "user" | "tool" | "function";
  content: ChatMessagePart[] | string | null;
  name?: string;
  tool_calls?: ChatCompletionMessageToolCall[];
  /** @deprecated use `tool_calls` instead */
  function_call?: ChatCompletionMeesageToolCallFunction;
}

export interface ChatOutputMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: ChatCompletionMessageToolCall[];
  /** @deprecated use `tool_calls` instead */
  function_call?: ChatCompletionMeesageToolCallFunction;
}

export interface ChatMessageImagePart {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

export type ChatMessagePart = ChatMessageTextPart | ChatMessageImagePart;

export interface ChatMessageTextPart {
  type: "text";
  text: string;
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

export type ChatModelName = "gpt-3.5-turbo" | "gpt-3.5-turbo-16k" | "gpt-4" | "gpt-4-32k" | "gpt-4o";
export type EmbedModelName = "text-embedding-ada-002";
