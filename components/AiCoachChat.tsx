"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { SparkleIcon } from "@/components/planner-icons";

// ── Types ───────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ActiveGoal {
  title: string;
  summary?: string;
}

// ── Component ───────────────────────────────────────────────────────
export function AiCoachChat({ activeGoals = [] }: { activeGoals?: ActiveGoal[] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || loading) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updated.map((m) => ({ role: m.role, content: m.content })),
            activeGoals,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content: `⚠️ ${data.error ?? "Something went wrong. Please try again."}`,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: data.reply ?? "I'm not sure how to respond to that.",
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: "⚠️ Network error — check your connection.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, activeGoals],
  );

  return (
    <>
      {/* ── Floating Trigger ── */}
      <button
        className="ai-coach-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Pace AI" : "Open Pace AI coach"}
        id="ai-coach-trigger"
      >
        <SparkleIcon size={17} />
        <span>Ask Pace AI</span>
      </button>

      {/* ── Drawer ── */}
      {open && (
        <aside className="ai-coach-drawer" role="dialog" aria-label="Pace AI Coach">
          {/* Header */}
          <header className="ai-coach-header">
            <div className="ai-coach-title-row">
              <span className="ai-coach-avatar">
                <SparkleIcon size={16} />
              </span>
              <div>
                <strong>Pace AI</strong>
                <small>Your productivity coach</small>
              </div>
            </div>
            <button className="ai-coach-close" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </header>

          {/* Messages */}
          <div className="ai-coach-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="ai-coach-empty">
                <SparkleIcon size={28} />
                <p>
                  <strong>Hey! I'm Pace AI.</strong>
                </p>
                <p>
                  Ask me anything about your goals — breaking bottlenecks, scheduling tips, or just
                  talk through what's stuck.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-coach-msg ai-coach-msg-${msg.role}`}>
                <div className="ai-coach-bubble">{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="ai-coach-msg ai-coach-msg-assistant">
                <div className="ai-coach-bubble ai-coach-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form className="ai-coach-form" onSubmit={sendMessage}>
            <input
              ref={inputRef}
              className="ai-coach-input"
              type="text"
              placeholder="Ask about your goals…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              maxLength={2000}
              id="ai-coach-input"
            />
            <button
              className="ai-coach-send"
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              id="ai-coach-send"
            >
              ↑
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
