import React, { useRef, useEffect } from "react";
import styles from "./InputBox.module.css";

interface InputBoxProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  disabled = false,
  placeholder = "Type your message...",
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSubmit(e as any);
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
