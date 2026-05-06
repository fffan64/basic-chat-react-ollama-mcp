import React, { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import { MessageDisplay } from "./MessageDisplay";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 0);
    }
  }, [messages, isLoading]);

  return (
    <div className={styles.messageList} ref={containerRef}>
      {messages.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>Welcome to Chat</h2>
          <p>Start a conversation by typing a message below</p>
        </div>
      ) : (
        <>
          {messages.map((msg) => (
            <MessageDisplay key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className={styles.loadingIndicator}>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
