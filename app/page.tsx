"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppNavigation from "@/app/components/AppNavigation";

type SpeechResultLike = { 0?: { transcript: string } };
type SpeechResultListLike = ArrayLike<SpeechResultLike>;
type SpeechRecognitionEventLike = { results: SpeechResultListLike };
type SpeechRecognitionErrorLike = { error?: string };

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function getLocalDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!showSuccess) return;
    const timeout = window.setTimeout(() => setShowSuccess(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [showSuccess]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const startOrStopListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice input isn't supported in this browser. You can type your expense instead.");
      return;
    }

    setError("");
    const recognition = new SpeechRecognition();
    const existingText = message.trim();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setMessage([existingText, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access was denied. You can type your expense instead."
        : "Voice input couldn't start. Please try again or type your expense.";
      setError(message);
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      // The browser asks for microphone access only after this user action.
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      setError("Voice input couldn't start. Please try again or type your expense.");
    }
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const expenseMessage = message.trim();
    if (!expenseMessage) {
      setError("Describe an expense before sending.");
      return;
    }

    recognitionRef.current?.stop();
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/ai-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: expenseMessage, localDate: getLocalDate() }),
      });
      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "The expense could not be saved.");
      }

      setMessage("");
      setShowSuccess(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The expense could not be saved. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="app-content-with-sidebar min-h-screen bg-slate-50 px-4 pb-10 pt-24 sm:px-6 lg:pr-8">
      <AppNavigation />

      {showSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="expense-success-card w-full max-w-sm rounded-3xl bg-white px-8 py-9 text-center shadow-2xl">
            <div className="expense-success-check mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/25">
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
                <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-950">Expense saved</h2>
            <p className="mt-2 text-sm text-slate-500">Your expense was added successfully.</p>
          </div>
        </div>
      )}

      <section className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-3xl flex-col justify-center py-12">
        <div className="mb-7 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expense Tracker</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Where did your money go?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Describe a purchase in your own words. I’ll record it when there’s enough detail.
          </p>
        </div>

        <form ref={formRef} onSubmit={handleSend} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.35)] sm:p-4">
          <label htmlFor="expense-message" className="sr-only">Describe your expense</label>
          <textarea
            id="expense-message"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (error) setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            maxLength={1200}
            rows={4}
            placeholder="e.g. Coffee and a bagel for $8.75 at Northside Cafe this morning"
            aria-describedby="expense-composer-help"
            className="min-h-32 w-full resize-y border-0 bg-transparent px-3 py-3 text-base leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
          />
          <div className="flex flex-col gap-3 border-t border-slate-100 px-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p id="expense-composer-help" className="text-xs text-slate-400">Press Enter to send · Shift+Enter for a new line</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={startOrStopListening}
                disabled={isSending}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
                aria-pressed={isListening}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 ${isListening ? "mic-listening border-slate-400 bg-slate-100 text-slate-900" : "border-slate-200 text-slate-600"}`}
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={isSending}
                aria-label={isSending ? "Saving expense" : "Send expense"}
                className="flex h-10 min-w-24 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-slate-700 hover:shadow-md active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
              >
                {isSending ? (
                  <>
                    <span className="sr-only">Saving expense</span>
                    <span aria-hidden="true" className="flex items-center gap-1">
                      <span className="loading-dot" />
                      <span className="loading-dot loading-dot-delay-1" />
                      <span className="loading-dot loading-dot-delay-2" />
                    </span>
                  </>
                ) : (
                  <>
                    Send
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                      <path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-3 min-h-6 text-center" aria-live="polite">
          {error && <p id="expense-composer-feedback" role="alert" className="text-sm text-red-700">{error}</p>}
          {!error && isListening && <p id="expense-composer-feedback" className="text-sm text-slate-500">Listening… speak your expense.</p>}
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Prefer a form?{" "}
          <Link href="/add-expense" className="font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950">
            Add manually
          </Link>
        </p>
      </section>
    </main>
  );
}
