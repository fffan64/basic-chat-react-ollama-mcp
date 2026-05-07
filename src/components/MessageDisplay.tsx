import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ChatMessage } from "../types";
import styles from "./MessageDisplay.module.css";

interface MessageDisplayProps {
  message: ChatMessage;
}

export const MessageDisplay: React.FC<MessageDisplayProps> = ({ message }) => {
  return (
    <div
      className={`${styles.messageWrapper} ${
        message.role === "user" ? styles.userMessage : styles.assistantMessage
      }`}
    >
      <div className={styles.messageBubble}>
        {message.role === "assistant" ? (
          <Markdown
            rehypePlugins={[rehypeRaw]}
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = !className;
                return !isInline && match ? (
                  <SyntaxHighlighter
                    language={match[1]}
                    style={dark}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              img({ src, alt, ...props }) {
                return (
                  <img
                    src={src}
                    alt={alt}
                    className={styles.image}
                    {...props}
                  />
                );
              },
              a({ href, children, ...props }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
              p({ children, ...props }) {
                return (
                  <p className={styles.paragraph} {...props}>
                    {children}
                  </p>
                );
              },
              ul({ children, ...props }) {
                return (
                  <ul className={styles.list} {...props}>
                    {children}
                  </ul>
                );
              },
              ol({ children, ...props }) {
                return (
                  <ol className={styles.list} {...props}>
                    {children}
                  </ol>
                );
              },
              blockquote({ children, ...props }) {
                return (
                  <blockquote className={styles.blockquote} {...props}>
                    {children}
                  </blockquote>
                );
              },
            }}
          >
            {message.content}
          </Markdown>
        ) : (
          <p className={styles.paragraph}>{message.content}</p>
        )}

        {message.isStreaming && <span className={styles.cursor}>▊</span>}
      </div>
    </div>
  );
};
