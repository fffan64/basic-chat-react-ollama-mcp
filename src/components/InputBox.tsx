import React, { useRef, useEffect, useState } from "react";
import styles from "./InputBox.module.css";

interface InputBoxProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  messages: any[]; // We'll use this to access chat history
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  disabled = false,
  placeholder = "Type your message...",
  messages
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [cachedInput, setCachedInput] = useState<string>("");

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputRef.current?.value.trim();
    if (text && !disabled) {
      onSubmit(text);
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.style.height = "auto";
        setHistoryIndex(null); // Reset history navigation
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSubmit(e as any);
    }

    // Handle up arrow key for message history
    if (e.key === "ArrowUp") {
      if (inputRef.current) {
        const currentText = inputRef.current.value.trim();

        // Find user messages (excluding system messages)
        const userMessages = messages.filter(msg => msg.role === "user");

        if (userMessages.length > 0) {
          // If we're not currently cycling through history, cache current input and start from the most recent user message
          if (historyIndex === null) {
            setCachedInput(currentText);
            setHistoryIndex(0);
          } else {
            // Cycle to previous message in history (if not at the beginning)
            if (historyIndex < userMessages.length - 1) {
              setHistoryIndex(prev => prev + 1);
            }
          }

          // Populate the input with the appropriate message
          if (historyIndex !== null && historyIndex < userMessages.length) {
            const messageIndex = userMessages.length - 1 - historyIndex;
            inputRef.current.value = userMessages[messageIndex].content;
            // Adjust textarea height to fit the content
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
            e.preventDefault(); // Prevent default behavior
          }
        }
      }
    }

    // Handle down arrow key to clear history navigation
    if (e.key === "ArrowDown") {
      if (inputRef.current && historyIndex !== null) {
        const userMessages = messages.filter(msg => msg.role === "user");

        // If we're at the end of history (back to the cached input), clear and reset
        if (historyIndex >= userMessages.length - 1) {
          inputRef.current.value = cachedInput;
          setHistoryIndex(null);
        } else {
          // Move forward in history
          setHistoryIndex(prev => prev + 1);

          // Populate the input with the appropriate message
          if (historyIndex < userMessages.length) {
            const messageIndex = userMessages.length - 1 - historyIndex;
            inputRef.current.value = userMessages[messageIndex].content;
            // Adjust textarea height to fit the content
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
            e.preventDefault(); // Prevent default behavior
          }
        }
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  };

  return (
    <form className={styles.inputBox} onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        className={styles.textarea}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onChange={handleInput}
        rows={1}
      />
      <button
        type="submit"
        className={styles.sendButton}
        disabled={disabled}
        title="Send (Ctrl+Enter or Cmd+Enter)"
      >
        {disabled ? "..." : "→"}
      </button>
    </form>
  );
};
