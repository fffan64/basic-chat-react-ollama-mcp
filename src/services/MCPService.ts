import type {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCPResource,
  MCPToolResult,
} from "../types";
import { TokenService } from "./TokenService";

/**
 * MCPService - Handles communication with MCP (Model Context Protocol) servers
 *
 * Key responsibilities:
 * 1. Initialize JSON-RPC session and capture session ID
 * 2. List available tools (not resources) for LLM to use
 * 3. Execute tool calls when LLM requests them (the critical execution loop)
 * 4. Format tool descriptions for LLM injection
 * 5. Parse LLM responses to detect tool invocations
 *
 * Note: MCP HTTP transport uses session-based communication:
 * - First POST initializes and returns Mcp-Session-Id header
 * - All future requests include this session ID header
 */
export class MCPService {
  private baseUrl: string;
  private requestId: number = 0;
  private sessionId: string | null = null;

  constructor(baseUrl: string = "http://localhost:5000") {
    this.baseUrl = baseUrl;
  }

  private generateRequestId(): string {
    return `req-${++this.requestId}-${Date.now()}`;
  }

  /**
   * Parse Server-Sent Events (SSE) format response
   * SSE format is: "event: message\ndata: {...json...}"
   */
  private parseSSEResponse(text: string): MCPResponse {
    // SSE format: multiple lines, with "data: " prefix containing JSON
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.substring(6); // Remove "data: " prefix
        try {
          return JSON.parse(jsonStr) as MCPResponse;
        } catch (e) {
          console.error("Failed to parse SSE data:", jsonStr);
          throw e;
        }
      }
    }

    // If no "data: " line found, try parsing as plain JSON
    try {
      return JSON.parse(text) as MCPResponse;
    } catch (e) {
      throw new Error(
        `Could not parse response as SSE or JSON: ${text.substring(0, 100)}`,
      );
    }
  }

  /**
   * Initialize MCP session with the server
   * Must be called before any other operations
   *
   * This will:
   * 1. Send initialize request
   * 2. Capture Mcp-Session-Id from response header or JSON
   * 3. Store session ID for all future requests
   */
  async initialize(): Promise<void> {
    try {
      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: this.generateRequestId(),
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {
            tools: {},
            resources: {},
          },
          clientInfo: {
            name: "ollama-chat-client",
            version: "1.0.0",
          },
        },
      };

      console.log("🔄 Sending initialize request...");

      // Use raw fetch to capture response headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      };

      // Add JWT token if available
      const authHeader = TokenService.getAuthHeader();
      if (authHeader) {
        headers["Authorization"] = authHeader;
        console.log("✓ Authorization header added");
      }

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`HTTP ${response.status} Response:`, text);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      console.log("📨 Response text:", text.substring(0, 200));

      // Log all response headers for debugging
      console.log("📋 Response headers:");
      const headerObj: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        console.log(`  ${name}: ${value}`);
        headerObj[name] = value;
      });

      // Try to capture session ID from headers (case-insensitive)
      this.sessionId =
        response.headers.get("Mcp-Session-Id") ||
        response.headers.get("mcp-session-id") ||
        response.headers.get("mcp_session_id") ||
        response.headers.get("x-mcp-session-id");

      // Also try to extract from response JSON
      if (!this.sessionId) {
        try {
          const data = this.parseSSEResponse(text);
          // Check if session ID is in the JSON response itself
          if ((data as any).sessionId) {
            this.sessionId = (data as any).sessionId;
            console.log("✓ Session ID from JSON response");
          }
          if ((data as any).result?.sessionId) {
            this.sessionId = (data as any).result.sessionId;
            console.log("✓ Session ID from result.sessionId");
          }
        } catch (e) {
          // Continue
        }
      }

      // If still no session ID, use a temporary one
      if (!this.sessionId) {
        console.warn(`⚠️  No Mcp-Session-Id found in headers or response!`);
        console.warn("Available headers:", Object.keys(headerObj));
        console.log("💡 The server may require stateless mode to be enabled.");
        // For now, don't set a session ID - let server handle it
        this.sessionId = null;
      } else {
        console.log(`✓ MCP session ID: ${this.sessionId}`);
      }

      try {
        // Parse SSE format response
        const data = this.parseSSEResponse(text);
        if (data.error) {
          throw new Error(`MCP initialization failed: ${data.error.message}`);
        }
        console.log("✓ MCP initialized successfully");
      } catch (e) {
        console.error("Failed to parse MCP response:", e);
        throw new Error(`Invalid response from MCP server: ${e}`);
      }
    } catch (error) {
      throw new Error(`MCP initialization error: ${error}`);
    }
  }

  /**
   * Cleanup - close session if needed
   */
  close(): void {
    this.sessionId = null;
    console.log("✓ MCP session closed");
  }

  /**
   * List available tools from MCP server
   * Tools are executable functions that the LLM can invoke
   */
  async listTools(): Promise<MCPTool[]> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: this.generateRequestId(),
      method: "tools/list",
      params: {},
    };

    try {
      const response = await this.sendRequest(request);

      if (response.error) {
        console.warn(`Failed to list tools: ${response.error.message}`);
        return [];
      }

      if (response.result && Array.isArray(response.result.tools)) {
        return response.result.tools as MCPTool[];
      }

      return [];
    } catch (error) {
      console.error("Error listing tools:", error);
      return [];
    }
  }

  /**
   * List available resources from MCP server
   * Resources are static data/files that can be read but not executed
   */
  async listResources(): Promise<MCPResource[]> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: this.generateRequestId(),
      method: "resources/list",
      params: {},
    };

    try {
      const response = await this.sendRequest(request);

      if (response.error) {
        console.warn(`Failed to list resources: ${response.error.message}`);
        return [];
      }

      if (response.result && Array.isArray(response.result.resources)) {
        return response.result.resources as MCPResource[];
      }

      return [];
    } catch (error) {
      console.error("Error listing resources:", error);
      return [];
    }
  }

  /**
   * Execute a tool on the MCP server
   * THIS IS THE CRITICAL EXECUTION LOOP
   *
   * When the LLM decides it needs to use a tool, this method actually runs it
   * and returns the result back to be fed into the chat context.
   */
  async callTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<MCPToolResult> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: this.generateRequestId(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
    };

    try {
      const response = await this.sendRequest(request);

      if (response.error) {
        return {
          type: "error",
          error: response.error.message,
        };
      }

      if (response.result) {
        return {
          type: "text",
          text: JSON.stringify(response.result),
          data: response.result,
        };
      }

      return {
        type: "error",
        error: "No result from tool call",
      };
    } catch (error) {
      return {
        type: "error",
        error: `Tool execution failed: ${error}`,
      };
    }
  }

  /**
   * Get all available tools and resources for context injection
   * Fetches both in parallel for efficiency
   */
  async getContext(): Promise<{
    tools: MCPTool[];
    resources: MCPResource[];
  }> {
    try {
      const [tools /* resources */] = await Promise.all([
        this.listTools(),
        // this.listResources(),
      ]);
      return { tools, resources: [] };
    } catch (error) {
      console.error("Error getting context:", error);
      return { tools: [], resources: [] };
    }
  }

  /**
   * Format tools for injection into LLM system prompt
   * The LLM will see this and know what tools are available
   */
  formatToolsForPrompt(tools: MCPTool[]): string {
    if (tools.length === 0) {
      return "No tools available.";
    }

    const toolDescriptions = tools
      .map((tool) => {
        let desc = `- **${tool.name}**`;
        if (tool.description) {
          desc += `: ${tool.description}`;
        }
        if (tool.inputSchema) {
          desc += `\n  Input schema: ${JSON.stringify(tool.inputSchema)}`;
        }
        return desc;
      })
      .join("\n");

    return `[Available MCP Tools]\nYou have access to these tools:\n${toolDescriptions}\n\nWhen you need to use a tool, indicate it with: {"tool": "tool_name", "params": {}}`;
  }

  /**
   * Parse LLM response to detect tool call intent
   * Looks for JSON patterns like: {"tool": "name", "params": {...}}
   *
   * This is crucial: the LLM will output its intention to use a tool,
   * and this parser intercepts that and prepares it for execution.
   */
  parseToolCall(
    content: string,
  ): { toolName: string; params: Record<string, unknown> } | null {
    try {
      // Try to find and parse JSON objects from the response
      // Use a more robust approach that handles nested objects

      // Find all potential JSON blocks
      const jsonBlocks = [];
      let braceCount = 0;
      let startIndex = -1;

      for (let i = 0; i < content.length; i++) {
        if (content[i] === "{") {
          if (braceCount === 0) {
            startIndex = i;
          }
          braceCount++;
        } else if (content[i] === "}") {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            jsonBlocks.push(content.substring(startIndex, i + 1));
          }
        }
      }

      console.log(
        `🔍 Found ${jsonBlocks.length} potential JSON blocks in response`,
      );

      // Try to parse each JSON block and look for one with a "tool" field
      for (const block of jsonBlocks) {
        try {
          const parsed = JSON.parse(block);
          console.log("📄 Parsed JSON:", parsed);

          // Look for tool field
          if (parsed.tool && typeof parsed.tool === "string") {
            console.log(`✓ Found tool call: ${parsed.tool}`);
            return {
              toolName: parsed.tool,
              params: (parsed.params as Record<string, unknown>) || {},
            };
          }
        } catch (e) {
          // This block wasn't valid JSON, continue
          console.log(
            `⚠️  Failed to parse JSON block: ${block.substring(0, 50)}`,
          );
        }
      }

      console.log("ℹ️  No tool call found in response");
      return null;
    } catch (e) {
      console.error("Error parsing tool call:", e);
      return null;
    }
  }

  /**
   * Send a JSON-RPC 2.0 request to the MCP server
   * All communication goes through this method
   * Includes session ID header if available
   * Includes JWT token in Authorization header if available
   * Parses Server-Sent Events (SSE) format responses
   */
  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      };

      // Include session ID if available
      if (this.sessionId) {
        headers["Mcp-Session-Id"] = this.sessionId;
        console.log(
          `[MCP Request] ${request.method} with session: ${this.sessionId.substring(0, 20)}...`,
        );
      } else {
        console.log(`[MCP Request] ${request.method} (no session ID)`);
      }

      // Add JWT token if available
      const authHeader = TokenService.getAuthHeader();
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(
          `❌ HTTP ${response.status} Response:`,
          text.substring(0, 200),
        );

        // Check if it's a session not found error
        if (response.status === 404 && text.includes("Session not found")) {
          console.warn("⚠️  Session expired or invalid. Reinitializing...");
          // Reset session and try again
          this.sessionId = null;
          throw new Error("Session expired - please reinitialize");
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();

      // Parse SSE format response
      try {
        const data = this.parseSSEResponse(text);
        return data;
      } catch (e) {
        console.error("❌ Failed to parse MCP response:", e);
        throw new Error(
          `Invalid response from MCP server: ${text.substring(0, 100)}`,
        );
      }
    } catch (error) {
      throw new Error(`Request to MCP server failed: ${error}`);
    }
  }
}
