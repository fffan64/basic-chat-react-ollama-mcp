/**
 * Chat Message Types
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  contentType?: "text" | "markdown" | "code" | "json";
  isStreaming?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error?: Error;
}

/**
 * Ollama API Types
 */
export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OllamaOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
  seed?: number;
  num_predict?: number;
}

export interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: OllamaOptions;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * MCP Protocol Types (JSON-RPC 2.0)
 */
export interface MCPRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: Record<string, unknown>;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP Tool Definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * MCP Resource Definition
 */
export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Tool Call Result
 */
export interface MCPToolResult {
  type: "text" | "image" | "resource" | "error";
  text?: string;
  data?: unknown;
  error?: string;
}

/**
 * MCP Context Type (enriched by MCP server)
 */
export interface MCPContext {
  tools?: MCPTool[];
  resources?: MCPResource[];
  knowledge?: string;
  [key: string]: unknown;
}

/**
 * Application Configuration
 */
export interface AppConfig {
  ollamaUrl: string;
  mcpUrl: string;
  model: string;
  systemPrompt: string;
}
