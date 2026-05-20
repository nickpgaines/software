"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import InboxTabs from "@/components/InboxTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Conversation = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  last_body: string | null;
  last_direction: "outbound" | "inbound" | null;
  last_at: string | null;
  unread_count: number;
};

type Message = {
  id: number;
  customer_id: number;
  body: string;
  direction: "outbound" | "inbound";
  created_at: string;
  read_at: string | null;
  status: string | null;
  error: string | null;
  provider_sid: string | null;
  to_phone: string | null;
  from_phone: string | null;
};

function relativeTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fullTime(iso: string) {
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MessagesClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadConversations() {
    const res = await fetch("/api/messages/conversations");
    if (res.ok) setConversations(await res.json());
  }

  useEffect(() => {
    loadConversations();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (unreadOnly && c.unread_count === 0) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.last_body || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, search, unreadOnly]);

  const selected =
    conversations.find((c) => c.id === selectedId) || null;

  return (
    <div className="flex flex-col bg-card overflow-hidden h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] md:h-[100dvh]">
      <div
        className={
          "shrink-0 " + (selected ? "hidden md:block" : "block")
        }
      >
        <div className="px-4 md:px-10 pt-[calc(env(safe-area-inset-top)+1rem)] md:pt-10 pb-4 flex items-center justify-between gap-3 flex-wrap">
          <InboxTabs />
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              title="Compose"
              className="w-8 h-8 p-0 rounded-full hover:bg-black text-zinc-400 shrink-0"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
      <aside
        className={
          "w-full md:w-80 shrink-0 border-r border-line flex-col " +
          (selected ? "hidden md:flex" : "flex")
        }
      >
        <div className="px-4 pt-2 pb-2">
          <div className="relative">
            <Input
              type="search"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-auto bg-black border-line rounded-full pl-9 pr-3 py-2 text-sm focus-visible:ring-zinc-500"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
        </div>
        <div className="px-4 pb-3 flex items-center justify-between">
          <Label className="text-xs font-normal text-zinc-400 flex items-center gap-2">
            <Checkbox
              checked={unreadOnly}
              onCheckedChange={(checked) => setUnreadOnly(checked === true)}
              className="border-line-strong"
            />
            Unread only
          </Label>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-line">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">
              {conversations.length === 0
                ? "No customers yet."
                : "No matching conversations."}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((c) => (
                <li key={c.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedId(c.id)}
                    className={
                      "w-full h-auto text-left px-4 py-3 flex gap-3 justify-start rounded-none whitespace-normal hover:bg-black " +
                      (selectedId === c.id ? "bg-black" : "")
                    }
                  >
                    <div className="w-9 h-9 rounded-full bg-line text-zinc-300 flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials(c.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-bold text-white tracking-tight truncate">
                          {c.name}
                        </span>
                        <span
                          className="text-[10px] text-zinc-500 shrink-0"
                          suppressHydrationWarning
                        >
                          {mounted ? relativeTime(c.last_at) : ""}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {c.phone || "—"}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-zinc-400 truncate">
                          {c.last_direction === "outbound" ? "You: " : ""}
                          {c.last_body || (
                            <span className="italic text-zinc-500">
                              No messages yet
                            </span>
                          )}
                        </span>
                        {c.unread_count > 0 && (
                          <Badge
                            variant="default"
                            className="text-[10px] bg-slate-900 text-white rounded-full px-1.5 py-0.5 shrink-0 border-transparent font-normal hover:bg-slate-900"
                          >
                            {c.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main
        className={
          "flex-1 flex-col min-w-0 overflow-hidden " +
          (selected ? "flex" : "hidden md:flex")
        }
      >
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
            Select a conversation
          </div>
        ) : (
          <Thread
            conversation={selected}
            mounted={mounted}
            onBack={() => setSelectedId(null)}
            onMessageSent={() => loadConversations()}
          />
        )}
      </main>
      </div>
    </div>
  );
}

function Thread({
  conversation,
  mounted,
  onBack,
  onMessageSent,
}: {
  conversation: Conversation;
  mounted: boolean;
  onBack: () => void;
  onMessageSent: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function draftReply() {
    setDraftError(null);
    setDrafting(true);
    try {
      const res = await fetch("/api/messages/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: conversation.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setDraftError(data.error || `Could not draft (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as { draft: string };
      setBody(data.draft);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Network error");
    } finally {
      setDrafting(false);
    }
  }

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/messages?customer_id=${conversation.id}`);
    if (res.ok) {
      const data = (await res.json()) as Message[];
      setMessages(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    setMessages([]);
    load();
  }, [conversation.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: conversation.id, body: text }),
    });
    setSending(false);
    if (res.ok) {
      const created = (await res.json()) as Message;
      setMessages((arr) => [...arr, created]);
      setBody("");
      onMessageSent();
    }
  }

  return (
    <>
      <header className="px-5 py-3 border-b border-line flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          aria-label="Back to conversations"
          className="md:hidden w-8 h-8 p-0 rounded-full text-zinc-400 hover:bg-black shrink-0"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </Button>
        <div className="w-9 h-9 rounded-full bg-line text-zinc-300 flex items-center justify-center text-xs font-semibold">
          {initials(conversation.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-white tracking-tight truncate">
            {conversation.name}
          </div>
          <div className="text-xs text-zinc-400 truncate">
            {conversation.phone || "—"}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 bg-black/40">
        {loading ? (
          <div className="text-center text-sm text-zinc-500 py-6">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-zinc-500 py-10">
            No messages yet. Send the first one below.
          </div>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const out = m.direction === "outbound";
              const failed =
                out && (m.status === "failed" || m.status === "not_configured");
              return (
                <li
                  key={m.id}
                  className={"flex " + (out ? "justify-end" : "justify-start")}
                >
                  <div className="max-w-[75%] min-w-0 flex flex-col items-end gap-1">
                    <div
                      className={
                        "rounded-2xl px-3 py-2 text-sm [overflow-wrap:anywhere] " +
                        (out
                          ? failed
                            ? "bg-rose-100 border border-rose-200 text-rose-900 rounded-br-sm"
                            : "bg-slate-900 text-white rounded-br-sm"
                          : "bg-card border border-line text-white rounded-bl-sm")
                      }
                    >
                      <div>{m.body}</div>
                      <div
                        className={
                          "text-[10px] mt-1 " +
                          (out
                            ? failed
                              ? "text-rose-700"
                              : "text-zinc-500"
                            : "text-zinc-500")
                        }
                        suppressHydrationWarning
                      >
                        {mounted ? fullTime(m.created_at) : ""}
                      </div>
                    </div>
                    {failed && (
                      <div className="text-[10px] text-rose-600 max-w-full text-right">
                        {m.status === "not_configured"
                          ? "Not sent — connect Twilio in Settings → Messaging"
                          : `Not delivered${m.error ? ` — ${m.error}` : ""}`}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line">
        {(drafting || draftError) && (
          <div className="px-4 pt-2 text-xs">
            {drafting && (
              <span className="text-zinc-400">Drafting reply with Claude…</span>
            )}
            {draftError && (
              <span className="text-rose-600">{draftError}</span>
            )}
          </div>
        )}
        <form
          onSubmit={send}
          className="px-4 pt-3 pb-3 flex items-center gap-2"
        >
          <Button
            type="button"
            variant="ghost"
            onClick={draftReply}
            disabled={drafting}
            title="Draft a reply with Claude"
            className="shrink-0 h-auto gap-1 text-xs font-bold bg-violet-50 hover:bg-violet-100 text-violet-900 border border-violet-200 rounded-full px-3 py-2 [&_svg]:size-3.5"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
            </svg>
            {drafting ? "Drafting…" : "Draft"}
          </Button>
          <Input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 h-auto border-line rounded-full px-4 py-2 text-sm bg-card focus-visible:ring-zinc-500"
          />
          <Button
            type="submit"
            variant="ghost"
            disabled={sending || !body.trim()}
            className="bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-full w-10 h-10 p-0"
            aria-label="Send"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </Button>
        </form>
      </div>
    </>
  );
}
