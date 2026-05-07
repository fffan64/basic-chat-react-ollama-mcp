import React, { useCallback, useState } from "react";
import { useChat } from "../hooks/useChat";
import { MessageList } from "./MessageList";
import { InputBox } from "./InputBox";
import styles from "./ChatInterface.module.css";

export const ChatInterface: React.FC = () => {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    selectedModel,
    availableModels,
    modelsLoading,
    setSelectedModel,
  } = useChat();
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
        <div className={styles.headerTop}>
          <h1>Chat with Ollama (MCP Powered)</h1>
        </div>
        <div className={styles.modelSelector}>
          <label htmlFor="model-select">Model:</label>
          {modelsLoading ? (
            <span className={styles.loadingText}>Loading models...</span>
          ) : (
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoading}
              className={styles.selectBox}
            >
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          )}
        </div>
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
