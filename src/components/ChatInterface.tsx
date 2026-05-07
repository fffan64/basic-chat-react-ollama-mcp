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
    clearHistory,
  } = useChat();
  const [localError, setLocalError] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const handleClearHistory = useCallback(() => {
    if (messages.length === 0) return;
    setShowConfirmClear(true);
  }, [messages.length]);

  const confirmClearHistory = useCallback(() => {
    clearHistory();
    setShowConfirmClear(false);
  }, [clearHistory]);

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
          <button
            onClick={handleClearHistory}
            disabled={messages.length === 0 || isLoading}
            className={styles.clearButton}
            title="Clear chat history and start fresh"
          >
            Clear History
          </button>
        </div>

        {showConfirmClear && (
          <div className={styles.confirmDialog}>
            <div className={styles.confirmOverlay}>
              <div className={styles.confirmBox}>
                <p>
                  Are you sure? This will clear all chat messages. This cannot
                  be undone.
                </p>
                <div className={styles.confirmButtons}>
                  <button
                    onClick={() => setShowConfirmClear(false)}
                    className={styles.confirmCancel}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmClearHistory}
                    className={styles.confirmClear}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
