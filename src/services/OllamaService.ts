import type { OllamaMessage, OllamaOptions, OllamaResponse } from "../types";

export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:11434") {
    this.baseUrl = baseUrl;
  }

  /**
   * Stream chat completion from Ollama
   * Yields chunks of text as they arrive
   */
  async *streamChat(
    model: string,
    messages: OllamaMessage[],
    options?: OllamaOptions,
  ): AsyncGenerator<string, void, unknown> {
    const url = `${this.baseUrl}/api/chat`;

    const body = {
      model,
      messages,
      stream: true,
      options: options || {},
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (each line is a JSON object)
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line) as OllamaResponse;
              if (json.message?.content) {
                yield json.message.content;
              }
            } catch (e) {
              // Skip malformed JSON
              console.error("Failed to parse Ollama response:", e);
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer) as OllamaResponse;
          if (json.message?.content) {
            yield json.message.content;
          }
        } catch (e) {
          console.error("Failed to parse final Ollama response:", e);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get single completion (non-streaming)
   */
  async chat(
    model: string,
    messages: OllamaMessage[],
    options?: OllamaOptions,
  ): Promise<string> {
    const url = `${this.baseUrl}/api/chat`;

    const body = {
      model,
      messages,
      stream: false,
      options: options || {},
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    const json = (await response.json()) as OllamaResponse;
    return json.message?.content || "";
  }

  /**
   * List available models
   */
  async listModels(): Promise<Array<{ name: string }>> {
    const url = `${this.baseUrl}/api/tags`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    const json = (await response.json()) as { models: Array<{ name: string }> };
    return json.models || [];
  }
}
