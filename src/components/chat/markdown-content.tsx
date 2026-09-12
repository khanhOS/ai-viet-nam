// KhanhOS AI — Markdown renderer cho AI response
// Hỗ trợ: markdown đầy đủ (GFM), code block + syntax highlight + copy code.

"use client";

import { memo, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

// ── Nút copy code ─────────────────────────────
function CodeBlockActions({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard API không khả dụng
    }
  }, [code]);

  return (
    <button
      onClick={copy}
      aria-label="Copy code"
      className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-black/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-md transition-all hover:bg-black/70 hover:text-foreground active:scale-95"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-primary" />
          <span className="text-primary">Đã copy</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  );
}

// ── Code block có header ngôn ngữ + copy ──────
function CodeBlock({
  language,
  value,
}: {
  language: string;
  value: string;
}) {
  const langLabel = language || "text";
  return (
    <div className="group relative my-3.5 overflow-hidden rounded-xl border border-foreground/10 bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-foreground/8 bg-white/[0.03] px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
          {langLabel}
        </span>
        <CodeBlockActions code={value} />
      </div>
      {/* Code */}
      <SyntaxHighlighter
        language={langLabel}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "14px 16px",
          background: "transparent",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
        codeTagProps={{
          style: { fontFamily: "var(--font-code, monospace)" },
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

// ── MarkdownContent ───────────────────────────
export const MarkdownContent = memo(function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={`kh-markdown ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className: cls, ...rest } = props;
            const match = /language-(\w+)/.exec(cls ?? "");
            const text = String(children);

            // Code block (```lang) vs inline (`code`)
            if (match || text.includes("\n")) {
              return (
                <CodeBlock
                  language={match?.[1] ?? ""}
                  value={text.replace(/\n$/, "")}
                />
              );
            }
            return (
              <code className={cls} {...rest}>
                {children}
              </code>
            );
          },
          a(props) {
            const { children, href } = props;
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
