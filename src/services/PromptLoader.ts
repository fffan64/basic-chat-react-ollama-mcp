const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant. Answer questions accurately and concisely.`;

export class PromptLoader {
  private cache?: string;

  /**
   * Load system prompt from public/system-prompt.txt
   * Falls back to default if file not found
   */
  async loadSystemPrompt(useCache: boolean = false): Promise<string> {
    if (useCache && this.cache) {
      return this.cache;
    }

    try {
      const response = await fetch("/system-prompt.txt");
      if (response.ok) {
        const prompt = await response.text();
        this.cache = prompt.trim() || DEFAULT_SYSTEM_PROMPT;
        return this.cache;
      }
    } catch (error) {
      console.warn("Failed to load system prompt file:", error);
    }

    return DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * Clear cache to force reload on next call
   */
  clearCache(): void {
    this.cache = undefined;
  }
}
