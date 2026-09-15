"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  User,
} from "lucide-react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type ChatResponse = {
  message?: string;
  model?: string;
  error?: string;
};

const STORAGE_KEY = "crm-general-chat-v1";
const MAX_LOCAL_MESSAGES = 60;

const suggestions = [
  "Explícame un tema complejo de forma sencilla",
  "Ayúdame a organizar una idea de negocio",
  "Resume las diferencias entre dos conceptos",
  "Dame ideas para aprender algo nuevo esta semana",
];

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isStoredMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Message>;
  return (
    typeof item.id === "string" &&
    (item.role === "user" || item.role === "assistant") &&
    typeof item.content === "string"
  );
}

export function GeneralChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      setMessages(parsed.filter(isStoredMessage).slice(-MAX_LOCAL_MESSAGES));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(messages.slice(-MAX_LOCAL_MESSAGES))
        );
      }
    } catch {
      // El chat sigue funcionando aunque el navegador bloquee localStorage.
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  function newConversation() {
    if (sending) return;
    setMessages([]);
    setDraft("");
    setError(null);
    setModel(null);
  }

  async function sendMessage(content: string) {
    const clean = content.trim();
    if (!clean || sending) return;

    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: clean.slice(0, 8_000),
    };

    const nextMessages = [...messages, userMessage].slice(-MAX_LOCAL_MESSAGES);
    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setSending(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 50_000);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-20).map(({ role, content: text }) => ({
            role,
            content: text,
          })),
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as ChatResponse;

      if (!response.ok || !payload.message) {
        throw new Error(payload.error || "No fue posible obtener una respuesta.");
      }

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: payload.message || "",
        },
      ]);
      setModel(payload.model || null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Error inesperado del chat.";
      setError(
        /abort/i.test(message)
          ? "La respuesta tardó demasiado. Intenta nuevamente."
          : message
      );
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

  return (
    <div className="space-y-6">
      <section className="crm-hero p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/10 bg-indigo-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-indigo-200">
              <Sparkles size={14} />
              Asistente general
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white lg:text-4xl">
              Chat General
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Haz preguntas generales, pide explicaciones, ideas, comparaciones, análisis o ayuda para organizar información. La conversación se guarda únicamente en este navegador.
            </p>
          </div>

          <button
            type="button"
            onClick={newConversation}
            disabled={sending || messages.length === 0}
            className="crm-button-secondary"
          >
            <Plus size={16} />
            Nueva conversación
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex min-h-[560px] flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-5 lg:p-7">
            {messages.length === 0 ? (
              <div className="mx-auto flex min-h-[380px] max-w-3xl flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl border border-indigo-300/10 bg-indigo-500/10 text-indigo-200">
                  <MessageCircle size={28} />
                </div>
                <h2 className="mt-5 text-2xl font-black text-white">Pregunta sobre cualquier tema</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Puedes comenzar escribiendo tu propia pregunta o usar una de estas ideas.
                </p>

                <div className="mt-6 grid w-full gap-3 md:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendMessage(suggestion)}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={[
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start",
                  ].join(" ")}
                >
                  {message.role === "assistant" ? (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-indigo-300/10 bg-indigo-500/10 text-indigo-200">
                      <Bot size={17} />
                    </div>
                  ) : null}

                  <div
                    className={[
                      "max-w-[88%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-7 lg:max-w-[78%]",
                      message.role === "user"
                        ? "bg-gradient-to-r from-indigo-600 to-sky-500 font-semibold text-white"
                        : "border border-white/10 bg-white/[0.045] text-slate-200",
                    ].join(" ")}
                  >
                    {message.content}
                  </div>

                  {message.role === "user" ? (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-sky-300/10 bg-sky-500/10 text-sky-200">
                      <User size={17} />
                    </div>
                  ) : null}
                </article>
              ))
            )}

            {sending ? (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <div className="grid h-9 w-9 place-items-center rounded-2xl border border-indigo-300/10 bg-indigo-500/10 text-indigo-200">
                  <Bot size={17} />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <Loader2 size={15} className="animate-spin" />
                  Pensando…
                </div>
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {error ? (
            <div className="mx-5 mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100 lg:mx-7">
              {error}
            </div>
          ) : null}

          <form onSubmit={submit} className="border-t border-white/10 bg-slate-950/75 p-4 lg:p-5">
            <div className="flex items-end gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 8_000))}
                onKeyDown={handleKeyDown}
                rows={3}
                disabled={sending}
                placeholder="Escribe tu pregunta…  Enter para enviar · Shift+Enter para nueva línea"
                className="min-h-[86px] flex-1 resize-none rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-lg shadow-indigo-950/30 transition hover:from-indigo-500 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar pregunta"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <span>Contexto enviado a la IA: máximo 20 mensajes.</span>
              <span>{model ? `Modelo: ${model}` : "Modelo definido por el servidor"}</span>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
