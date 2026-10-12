"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Visualization =
  | { kind: "monthly-comparison"; currentMonth: string; currentTotal: number; previousMonth: string; previousTotal: number }
  | { kind: "money-summary"; toReceive: number; toPay: number; netBalance: number; pendingEntryCount: number }
  | { kind: "category-breakdown"; period: string; categories: Array<{ category: string; total: number }> }
  | { kind: "category-total"; category: string; month: string; total: number; count: number };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  visualization?: Visualization | null;
};

const greeting: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content: "Hi! I’m Doraemon, your personal finance assistant. Ask me about your spending or money tracker, and I’ll use the records in your account.",
};

const suggestedPrompts = [
  "How much did I spend on food last month?",
  "Compare this month with last month.",
  "Where did most of my money go?",
  "Show my money tracker summary.",
];

const sessionKey = "expense-tracker-doraemon-chat-v1";

function makeMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getLocalDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount);
}

function formatMonth(month: string) {
  if (month === "all-time") return "All time";
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function DoraemonAssistant({ userId }: { userId: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConversationReady, setIsConversationReady] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const userSessionKey = userId ? `${sessionKey}:${userId}` : null;

  useEffect(() => {
    if (!userSessionKey) {
      setMessages([greeting]);
      setIsConversationReady(true);
      return;
    }

    try {
      const saved = sessionStorage.getItem(userSessionKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const safeMessages = parsed.filter((item): item is ChatMessage => (
            item && typeof item === "object" &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string" && typeof item.id === "string"
          )).slice(-30);
          if (safeMessages.length) setMessages(safeMessages);
        }
      }
    } catch {
      // A malformed local conversation should never prevent opening the assistant.
    }
    setIsConversationReady(true);
  }, [userSessionKey]);

  useEffect(() => {
    if (!isConversationReady || !userSessionKey) return;
    try {
      sessionStorage.setItem(userSessionKey, JSON.stringify(messages.slice(-30)));
    } catch {
      // Keep the current conversation usable if browser storage is unavailable.
    }
  }, [isConversationReady, messages, userSessionKey]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    transcript.scrollTo({ top: transcript.scrollHeight, behavior });
  }, [isLoading, messages, isOpen]);

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || isLoading) return;

    const history = messages
      .filter((item) => item.id !== "greeting")
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { id: makeMessageId(), role: "user", content: message }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/doraemon-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, localDate: getLocalDate() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.answer !== "string") {
        throw new Error(typeof result?.error === "string" ? result.error : "Doraemon couldn't answer just now. Please try again.");
      }
      setMessages((current) => [...current, {
        id: makeMessageId(),
        role: "assistant",
        content: result.answer,
        visualization: result.visualization ?? null,
      }]);
    } catch (error) {
      setMessages((current) => [...current, {
        id: makeMessageId(),
        role: "assistant",
        content: error instanceof Error ? error.message : "Doraemon couldn't answer just now. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <>
      {isOpen && (
        <section
          id="dora-chat-panel"
          className={`dora-chat-panel fixed z-[70] flex flex-col overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-[0_20px_65px_-24px_rgba(15,23,42,0.42)] ${isExpanded ? "dora-chat-panel-expanded" : ""}`}
          role="dialog"
          aria-label="Chat with Doraemon"
          aria-describedby="dora-chat-subtitle"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 py-3.5 sm:px-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50">
              <Image src="/doraemon-sticker.png" alt="Doraemon" width={42} height={42} className="h-10 w-10 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-950">Doraemon</h2>
              <p id="dora-chat-subtitle" className="truncate text-[11px] text-slate-500">Your personal finance assistant</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => { setIsOpen(false); setIsExpanded(false); }} aria-label="Minimize chat" title="Minimize" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true"><path d="M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
              <button type="button" onClick={() => setIsExpanded((current) => !current)} aria-label={isExpanded ? "Restore chat size" : "Expand chat"} title={isExpanded ? "Restore size" : "Expand"} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                {isExpanded ? (
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true"><path d="M7 4v3H4M13 4v3h3M7 16v-3H4m9 3v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true"><path d="M7 4H4v3m9-3h3v3M7 16H4v-3m9 3h3v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
              <button type="button" onClick={() => { setIsOpen(false); setIsExpanded(false); }} aria-label="Close chat" title="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </button>
            </div>
          </header>

          <div ref={transcriptRef} role="log" aria-label="Doraemon conversation" aria-live="polite" aria-relevant="additions text" className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-3.5 py-4 sm:px-4">
            {messages.map((message) => (
              <div key={message.id} className={`dora-message-enter flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && (
                  <span className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-sky-100">
                    <Image src="/doraemon-sticker.png" alt="" width={26} height={26} className="h-6 w-6 object-contain" />
                  </span>
                )}
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 shadow-sm ${message.role === "user" ? "rounded-br-md bg-slate-900 text-white" : "rounded-bl-md border border-slate-100 bg-white text-slate-700"}`}>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  {message.visualization && <AssistantVisualization visualization={message.visualization} />}
                </div>
              </div>
            ))}

            {messages.filter((message) => message.role === "user").length === 0 && (
              <div className="dora-message-enter space-y-2 pl-9" aria-label="Suggested questions">
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} className="block w-full rounded-xl border border-sky-100 bg-white px-3 py-2 text-left text-xs leading-4 text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="dora-message-enter flex items-end gap-2" role="status" aria-label="Doraemon is thinking">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-sky-100">
                  <Image src="/doraemon-sticker.png" alt="" width={26} height={26} className="h-6 w-6 object-contain" />
                </span>
                <span className="flex h-9 items-center gap-1 rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3 text-sky-600 shadow-sm">
                  <span className="loading-dot" /><span className="loading-dot loading-dot-delay-1" /><span className="loading-dot loading-dot-delay-2" />
                </span>
                <span className="sr-only">Doraemon is thinking</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex shrink-0 items-end gap-2 border-t border-slate-100 bg-white p-3 sm:p-3.5">
            <label htmlFor="dora-chat-input" className="sr-only">Ask Doraemon about your expenses</label>
            <textarea
              id="dora-chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              maxLength={1200}
              rows={1}
              placeholder="Ask about your spending..."
              className="max-h-24 min-h-10 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-50"
            />
            <button type="submit" disabled={!input.trim() || isLoading} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-40">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </form>
          <p className="shrink-0 bg-white px-4 pb-2.5 text-center text-[10px] text-slate-400">Answers use only your account’s saved expense and Money Tracker data.</p>
        </section>
      )}

      {!isOpen && (
        <div className="group fixed bottom-5 right-5 z-[70]">
          <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 mb-3 w-max rounded-xl border border-sky-100 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 opacity-0 shadow-lg shadow-sky-900/10 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
            Ask Doraemon about your expenses!
          </span>
          <button
            type="button"
            onClick={() => { setIsOpen(true); setIsExpanded(false); }}
            aria-label="Ask Doraemon about your expenses"
            className="dora-launcher flex h-[68px] w-[68px] items-center justify-center rounded-full border border-sky-100 bg-white shadow-[0_7px_24px_rgba(37,99,235,0.2)] transition duration-200 hover:scale-105 hover:shadow-[0_8px_30px_rgba(37,99,235,0.32)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <Image src="/doraemon-sticker.png" alt="" width={60} height={60} className="h-[60px] w-[60px] object-contain" />
          </button>
        </div>
      )}
    </>
  );
}

function AssistantVisualization({ visualization }: { visualization: Visualization }) {
  if (visualization.kind === "money-summary") {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Money Tracker summary cards">
        <MetricCard label="To receive" value={formatMoney(visualization.toReceive)} tone="green" />
        <MetricCard label="To pay" value={formatMoney(visualization.toPay)} tone="red" />
        <MetricCard label="Net balance" value={formatMoney(visualization.netBalance)} tone={visualization.netBalance >= 0 ? "blue" : "red"} />
        <MetricCard label="Pending" value={`${visualization.pendingEntryCount} entries`} tone="blue" />
      </div>
    );
  }

  if (visualization.kind === "monthly-comparison") {
    const difference = visualization.currentTotal - visualization.previousTotal;
    const differenceText = difference === 0 ? "No change" : `${difference > 0 ? "+" : "−"}${formatMoney(Math.abs(difference))}`;
    return (
      <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Monthly expense comparison">
        <MetricCard label={formatMonth(visualization.previousMonth)} value={formatMoney(visualization.previousTotal)} tone="blue" />
        <MetricCard label={formatMonth(visualization.currentMonth)} value={formatMoney(visualization.currentTotal)} tone="blue" />
        <p className="col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">Change: <strong className="text-slate-800">{differenceText}</strong></p>
      </div>
    );
  }

  if (visualization.kind === "category-total") {
    return <div className="mt-3"><MetricCard label={`${visualization.category} · ${formatMonth(visualization.month)}`} value={formatMoney(visualization.total)} detail={`${visualization.count} ${visualization.count === 1 ? "expense" : "expenses"}`} tone="blue" /></div>;
  }

  const maxTotal = Math.max(0, ...visualization.categories.map((item) => item.total));
  return (
    <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3" aria-label={`Top categories for ${formatMonth(visualization.period)}`}>
      <p className="mb-2 text-[11px] font-semibold text-slate-500">Spending by category · {formatMonth(visualization.period)}</p>
      {visualization.categories.length ? (
        <div className="space-y-2">
          {visualization.categories.map((item) => (
            <div key={item.category}>
              <div className="mb-1 flex justify-between gap-2 text-[10px] text-slate-600"><span className="truncate">{item.category}</span><span className="font-semibold text-slate-800">{formatMoney(item.total)}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${maxTotal ? Math.max(4, item.total / maxTotal * 100) : 0}%` }} /></div>
            </div>
          ))}
        </div>
      ) : <p className="text-[11px] text-slate-500">No expense records in this period.</p>}
    </div>
  );
}

function MetricCard({ label, value, tone, detail }: { label: string; value: string; tone: "green" | "red" | "blue"; detail?: string }) {
  const colors = tone === "green" ? "bg-emerald-50 text-emerald-800" : tone === "red" ? "bg-rose-50 text-rose-800" : "bg-sky-50 text-slate-800";
  return (
    <div className={`min-w-0 rounded-xl px-3 py-2.5 ${colors}`}>
      <p className="text-[10px] font-medium opacity-75">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
      {detail && <p className="mt-0.5 text-[10px] opacity-70">{detail}</p>}
    </div>
  );
}
