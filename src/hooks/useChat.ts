import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage, ChatState, OllamaMessage } from "../types";
import { OllamaService } from "../services/OllamaService";
import { MCPService } from "../services/MCPService";
import { PromptLoader } from "../services/PromptLoader";
import { TokenService } from "../services/TokenService";
import { useAuth0 } from "@auth0/auth0-react";

const ollamaService = new OllamaService("http://localhost:11434");
const mcpService = new MCPService("http://localhost:5000");
const promptLoader = new PromptLoader();

// Initialize MCP on module load
mcpService.initialize().catch((err) => {
  console.warn("MCP initialization failed, running without context:", err);
});

export const useChat = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
  });

  // Initialize JWT token from Auth0
  useEffect(() => {
    const initializeToken = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: "https://my-app.com" },
        });
        TokenService.setToken(token);
        console.log("✓ JWT token initialized from Auth0");
      } catch (err) {
        console.warn("Failed to get access token:", err);
        TokenService.setToken(null);
      }
    };

    initializeToken();
  }, [getAccessTokenSilently]);

  const generateId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Agentic execution loop - the critical missing piece
   * This intercepts LLM responses and executes tools when the LLM decides to use them
   */
  const executionLoop = useCallback(
    async (
      systemPrompt: string,
      conversationHistory: OllamaMessage[],
      availableTools: string,
    ): Promise<string> => {
      let conversationContext = [...conversationHistory];
      let maxIterations = 5;
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;
        console.log(
          `\n📍 Execution loop iteration ${iteration}/${maxIterations}`,
        );

        // Prepare messages for this turn
        const messages: OllamaMessage[] = [
          {
            role: "system",
            content: systemPrompt + "\n\n" + availableTools,
          },
          ...conversationContext,
        ];

        // Get LLM response
        let fullResponse = "";
        console.log("🤖 Waiting for LLM response...");
        for await (const chunk of ollamaService.streamChat(
          "qwen3.5:latest",
          messages,
        )) {
          fullResponse += chunk;
        }
        console.log("LLM Response:", fullResponse.substring(0, 150));

        // Check if LLM is trying to use a tool
        const toolCall = mcpService.parseToolCall(fullResponse);

        if (toolCall) {
          // Tool call detected - execute it
          console.log(
            `🔧 Executing tool: ${toolCall.toolName} with params:`,
            toolCall.params,
          );

          const toolResult = await mcpService.callTool(
            toolCall.toolName,
            toolCall.params,
          );

          console.log(`📦 Tool result:`, toolResult);

          // Add LLM response to context
          conversationContext.push({
            role: "assistant",
            content: fullResponse,
          });

          // Add tool result to context
          const resultMessage =
            toolResult.type === "error"
              ? `Tool execution failed: ${toolResult.error}`
              : `Tool result: ${toolResult.text}`;

          conversationContext.push({
            role: "system",
            content: resultMessage,
          });

          // Continue loop - LLM will see the tool result and respond
          console.log("↻ Tool executed, continuing conversation...");
          continue;
        }

        // No tool call - LLM has completed its response
        console.log("✓ Conversation complete");
        return fullResponse;
      }

      // Max iterations reached
      console.warn(
        "⚠ Max tool execution iterations reached, returning last response",
      );
      return "I've used several tools to help with your request.";
    },
    [],
  );

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim()) return;

      // Add user message
      const userMessageId = generateId();
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: userText,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        error: undefined,
      }));

      try {
        // Load system prompt
        const systemPrompt = await promptLoader.loadSystemPrompt();

        // Get available tools from MCP
        let availableToolsString = "";
        try {
          const { tools } = await mcpService.getContext();
          availableToolsString = mcpService.formatToolsForPrompt(tools);
          console.log(`✓ Loaded ${tools.length} tools from MCP`);
        } catch (err) {
          console.warn(
            "MCP tool loading failed, continuing without tools:",
            err,
          );
        }

        // Build conversation history for the execution loop
        const conversationHistory: OllamaMessage[] = state.messages
          .filter((msg) => msg.role !== "system")
          .map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));

        // Add current user message
        conversationHistory.push({
          role: "user",
          content: userText,
        });

        // Create assistant message for streaming
        const assistantMessageId = generateId();
        let fullContent = "";

        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: assistantMessageId,
              role: "assistant",
              content: "",
              isStreaming: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }));

        // Run the agentic execution loop
        const finalResponse = await executionLoop(
          systemPrompt,
          conversationHistory,
          availableToolsString,
        );

        fullContent = finalResponse;

        // Update final message
        setState((prev) => {
          const updated = [...prev.messages];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.id === assistantMessageId) {
            lastMsg.content = fullContent;
            lastMsg.isStreaming = false;
            lastMsg.updatedAt = new Date();
          }
          return {
            ...prev,
            messages: updated,
            isLoading: false,
          };
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: new Error(errorMessage),
        }));

        console.error("Chat error:", error);
      }
    },
    [state.messages, generateId, executionLoop],
  );

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
  };
};
