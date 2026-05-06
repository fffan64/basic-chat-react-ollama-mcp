import React, { useCallback, useState } from "react";
import { useChat } from "../hooks/useChat";
import { MessageList } from "./MessageList";
import { InputBox } from "./InputBox";
import styles from "./ChatInterface.module.css";

export const ChatInterface: React.FC = () => {
  const { messages, isLoading, error, sendMessage } = useChat();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (text: string) => {
      setLocalError(null);
      try {
        await sendMessage(text);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An error occurred";
        setLocalError(message);
      }
    },
    [sendMessage],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Chat with Ollama (MCP Powered)</h1>
        <p>Model: qwen3.5:latest</p>
      </div>

      {(error || localError) && (
        <div className={styles.errorBanner}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error?.message || localError}</span>
          <button
            className={styles.closeError}
            onClick={() => {
              setLocalError(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      <MessageList messages={messages} isLoading={isLoading} />

      <InputBox
        onSubmit={handleSubmit}
        disabled={isLoading}
        placeholder="Ask me anything... (Ctrl+Enter to send)"
      />
    </div>
  );
};
